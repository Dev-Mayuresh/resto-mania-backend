const axios = require("axios");

module.exports = (io, db) => {
    let activeSockets = new Set();
    let activeOrdersInterval = null;
    let previousOrdersInterval = null;
    let notifiedSessions = new Set(); // Track notified sessions

    io.on("connection", (socket) => {
        console.log(`🟢 User connected: ${socket.id}`);
        activeSockets.add(socket.id);

        // ✅ Fetch active orders including related sessions, dish names, and quantities
        const fetchActiveOrders = async () => {
            if (activeSockets.size === 0) return;
            try {
                console.log("🔍 Fetching active kitchen orders...");

                const orderQuery = `
                    SELECT * FROM Customer_Orders 
                    WHERE Order_Status IN ('Processing', 'Active') 
                    ORDER BY Order_Date DESC
                `;
                const orderResult = await db.query(orderQuery);
                let orders = orderResult.rows;

                if (orders.length === 0) {
                    console.log("ℹ No active kitchen orders found.");
                    io.emit("loadKitchenOrders", []);
                    return;
                }

                // Fetch sessions and items for each order
                for (let order of orders) {
                    const sessionQuery = `
                        SELECT session_id, order_id, session_start, session_status, updated_at
                        FROM Order_Sessions 
                        WHERE order_id = $1
                    `;
                    const sessionResult = await db.query(sessionQuery, [order.order_id]);
                    let sessions = sessionResult.rows;

                    if (sessions.length === 0) {
                        order.sessions = [];
                        continue;
                    }

                    // Fetch items for each session
                    for (let session of sessions) {
                        const itemQuery = `
                            SELECT oi.session_id, mi.item_name, oi.quantity
                            FROM Order_Items oi
                            JOIN Menu_Items mi ON oi.menu_item_id = mi.menu_item_id
                            WHERE oi.session_id = $1
                        `;
                        const itemResult = await db.query(itemQuery, [session.session_id]);
                        session.items = itemResult.rows;
                    }

                    order.sessions = sessions;
                }

                console.log(`📤 Sending ${orders.length} active kitchen orders.`);
                io.emit("loadKitchenOrders", orders);
            } catch (err) {
                console.error("❌ Error fetching active orders:", err);
            }
        };

        const fetchPreviousOrders = async () => {
            if (activeSockets.size === 0) return;
            console.log("📥 Requesting previous orders...");
        
            try {
                console.log("🔍 Fetching sessions with 'Completed' or 'Cancelled' status...");
        
                // ✅ Fetch sessions that are either 'Completed' or 'Cancelled'
                const sessionQuery = `
                    SELECT * FROM Order_Sessions 
                    WHERE Session_Status IN ('Completed', 'Cancelled')
                `;
                const sessionResult = await db.query(sessionQuery);
                console.log(`🔹 Found ${sessionResult.rows.length} matching sessions.`);
        
                const sessions = sessionResult.rows;
                if (sessions.length === 0) {
                    console.log("ℹ No previous sessions found.");
                    io.emit("loadPreviousOrders", []);
                    return;
                }
        
                // ✅ Extract Order IDs linked to these sessions
                const orderIds = [...new Set(sessions.map(session => session.order_id))];
                console.log(`🔹 Fetching orders linked to sessions: ${orderIds}`);
        
                // ✅ Fetch orders for these sessions (ignoring status)
                const orderQuery = `
                    SELECT * FROM Customer_Orders 
                    WHERE Order_ID = ANY($1)
                    ORDER BY Order_Date DESC
                `;
                const orderResult = await db.query(orderQuery, [orderIds]);
                console.log(`🔹 Found ${orderResult.rows.length} orders.`);
        
                const orders = orderResult.rows;
        
                // ✅ Extract Session IDs for fetching ordered items
                const sessionIds = sessions.map(session => session.session_id);
                console.log(`🔹 Fetching order items for sessions: ${sessionIds}`);
        
                const orderItemsQuery = `
                    SELECT oi.Session_ID, mi.Item_Name, oi.Quantity
                    FROM Order_Items oi
                    JOIN Menu_Items mi ON oi.Menu_Item_ID = mi.Menu_Item_ID
                    WHERE oi.Session_ID = ANY($1)
                `;
                const orderItemsResult = await db.query(orderItemsQuery, [sessionIds]);
                console.log(`🔹 Found ${orderItemsResult.rows.length} ordered items.`);
        
                const orderItems = orderItemsResult.rows;
        
                // ✅ Attach items to sessions
                const sessionsWithItems = sessions.map(session => ({
                    ...session,
                    items: orderItems.filter(item => item.session_id === session.session_id)
                }));
        
                // ✅ Attach sessions to orders
                const response = orders.map(order => ({
                    ...order,
                    sessions: sessionsWithItems.filter(session => session.order_id === order.order_id)
                }));
        
                console.log(`📤 Sending ${response.length} previous orders to client.`);
                io.emit("loadPreviousOrders", response);
            } catch (err) {
                console.error("❌ Error fetching previous orders:", err);
            }
        };
        

        // ✅ Start polling only when the first user connects
        if (!activeOrdersInterval) activeOrdersInterval = setInterval(fetchActiveOrders, 5000);
        if (!previousOrdersInterval) previousOrdersInterval = setInterval(fetchPreviousOrders, 15000);

        socket.on("disconnect", () => {
            console.log(`🔴 User disconnected: ${socket.id}`);
            activeSockets.delete(socket.id);

            if (activeSockets.size === 0) {
                clearInterval(activeOrdersInterval);
                clearInterval(previousOrdersInterval);
                activeOrdersInterval = null;
                previousOrdersInterval = null;
                console.log("⏸ Stopped polling as no users are connected.");
            }
        });
    });

    // ✅ Webhook for status updates (Only notify on specific status changes)
    setInterval(async () => {
        if (activeSockets.size === 0) return;
        try {
            console.log("🔍 Checking for order status updates...");

            // Fetch sessions with status: Accepted, Declined, Completed, Cancelled
            const statusQuery = `
                SELECT session_id, order_id, session_status 
                FROM Order_Sessions 
                WHERE session_status IN ('Accepted', 'Declined', 'Completed', 'Cancelled')
            `;
            const sessionResult = await db.query(statusQuery);

            for (const session of sessionResult.rows) {
                if (!notifiedSessions.has(session.session_id)) {
                    const webhookData = {
                        orderId: session.order_id,
                        sessionId: session.session_id,
                        newStatus: session.session_status
                    };

                    try {
                        await axios.post("https://present-karena-cpprestomania-99c22f9c.koyeb.app/webhook/order-update", webhookData);
                        console.log(`✅ Webhook sent for session ${session.session_id}: ${session.session_status}`);
                        notifiedSessions.add(session.session_id); // Prevent duplicate notifications
                    } catch (error) {
                        console.error("❌ Webhook failed:", error.response?.data || error.message);
                    }
                }
            }
        } catch (err) {
            console.error("❌ Error checking status updates:", err);
        }
    }, 5000);
};

