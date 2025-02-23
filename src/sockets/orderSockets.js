const axios = require("axios");

module.exports = (io, db) => {
    let activeSockets = new Set();
    let activeOrdersInterval = null;
    let previousOrdersInterval = null;
    let notifiedSessions = new Set(); // Track notified sessions

    io.on("connection", (socket) => {
        console.log(`🟢 User connected: ${socket.id}`);
        activeSockets.add(socket.id);

        // ✅ Fetch active orders including table details
        const fetchActiveOrders = async () => {
            if (activeSockets.size === 0) return;
            try {
                console.log("🔍 Fetching active kitchen orders...");
                const orderQuery = `
                    SELECT o.*, t.table_number, t.table_status 
                    FROM Customer_Orders o
                    JOIN Tables t ON o.table_id = t.table_id
                    WHERE o.Order_Status IN ('Processing', 'Active') 
                    ORDER BY o.Order_Date DESC
                `;
                const orderResult = await db.query(orderQuery);
                io.emit("loadKitchenOrders", orderResult.rows);
            } catch (err) {
                console.error("❌ Error fetching active orders:", err);
            }
        };

        // ✅ Fetch previous orders
        const fetchPreviousOrders = async () => {
            if (activeSockets.size === 0) return;
            console.log("📥 Requesting previous orders...");
            try {
                const sessionQuery = `SELECT * FROM Order_Sessions WHERE Session_Status IN ('Completed', 'Cancelled')`;
                const sessionResult = await db.query(sessionQuery);
                io.emit("loadPreviousOrders", sessionResult.rows);
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
                        await axios.post("http://localhost:5000/webhook/order-update", webhookData);
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

