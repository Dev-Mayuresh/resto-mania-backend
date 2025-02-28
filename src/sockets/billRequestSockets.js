const axios = require("axios");

module.exports = (io, db) => {
    let activeSockets = new Set();
    let pollingInterval = null;
    let previousBillStatuses = new Map(); // ✅ Track previous bill statuses

    io.on("connection", (socket) => {
        console.log(`🟢 User connected: ${socket.id}`);
        activeSockets.add(socket.id);

        // ✅ Fetch bill requests including table details
        const fetchBillRequests = async () => {
            if (activeSockets.size === 0) return;
            try {
                console.log("🔍 Fetching bill requests...");
                const billResult = await db.query(`
                    SELECT br.bill_request_id, br.order_id, br.requested_at, br.bill_status, 
                    t.table_number, t.table_status FROM Bill_Requests br
                    JOIN Tables t ON br.table_id = t.table_id
                    WHERE br.bill_status = 'Pending'
                    ORDER BY br.requested_at DESC;
                `);
                io.emit("loadBillRequests", billResult.rows);
            } catch (err) {
                console.error("❌ Error fetching bill requests:", err);
            }
        };

        if (!pollingInterval) pollingInterval = setInterval(fetchBillRequests, 5000);

        socket.on("disconnect", () => {
            console.log(`🔴 User disconnected: ${socket.id}`);
            activeSockets.delete(socket.id);
            if (activeSockets.size === 0) {
                clearInterval(pollingInterval);
                pollingInterval = null;
                console.log("⏸ Stopped polling as no users are connected.");
            }
        });
    });

    // ✅ Webhook for bill status updates (Only triggers if status changes)
    setInterval(async () => {
        if (activeSockets.size === 0) return;
        try {
            console.log("🔍 Checking for bill status updates...");
            const statusResult = await db.query(`
                SELECT 
                    br.bill_request_id, 
                    br.order_id, 
                    br.bill_status, 
                    co.client_id, 
                    ud.convo_id
                FROM Bill_Requests br
                JOIN Customer_Orders co ON br.order_id = co.order_id  
                JOIN user_details ud ON co.client_id = ud.client_id
                WHERE br.bill_status IN ('Generated')
            `);

            for (const bill of statusResult.rows) {
                const { order_id, bill_status, client_id, convo_id, bill_request_id } = bill;

                // ✅ Check if status has changed
                if (previousBillStatuses.get(order_id) !== bill_status) {
                    previousBillStatuses.set(order_id, bill_status); // Update cache

                    const webhookData = {
                        orderId: order_id,
                        billRequestId: bill_request_id,
                        newStatus: bill_status,
                        clientId: client_id,
                        conversationId: convo_id,
                        type: "bill_update"
                    };

                    try {
                        await axios.post("https://webhook.botpress.cloud/6c6aa75d-ce99-42a3-b6aa-d499c957ed2a", webhookData);
                        console.log(`✅ Webhook sent for bill ${client_id}: ${convo_id}: ${bill_request_id}: ${bill_status}`);
                    } catch (error) {
                        console.error("❌ Webhook failed:", error.response?.data || error.message);
                    }
                }
            }

            // ✅ Cleanup stale entries (Remove orders no longer in the list)
            const activeOrderIds = new Set(statusResult.rows.map(row => row.order_id));
            previousBillStatuses.forEach((_, orderId) => {
                if (!activeOrderIds.has(orderId)) {
                    previousBillStatuses.delete(orderId);
                }
            });

        } catch (err) {
            console.error("❌ Error checking bill status updates:", err);
        }
    }, 5000);
};
