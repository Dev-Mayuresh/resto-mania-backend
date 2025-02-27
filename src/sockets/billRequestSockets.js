const axios = require("axios");

module.exports = (io, db) => {
    let activeSockets = new Set();
    let pollingInterval = null;

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

    // ✅ Webhook for bill status updates (Unchanged)
    setInterval(async () => {
        if (activeSockets.size === 0) return;
        try {
            console.log("🔍 Checking for bill status updates...");
            const statusResult = await db.query(`SELECT 
            br.bill_request_id, 
            br.order_id, 
            br.bill_status, 
            co.client_id, 
            ud.convo_id
            FROM Bill_Requests br
            JOIN Customer_Orders co ON br.order_id = co.order_id  
            JOIN user_details ud ON co.client_id = ud.client_id
            WHERE br.bill_status IN ('Generated')`);

            for (const bill of statusResult.rows) {
                const webhookData = { orderId: bill.order_id, 
                    billRequestId: bill.bill_request_id, 
                    newStatus: bill.bill_status,
                    clientId: bill.client_id,
                    conversationId: bill.convo_id,
                    type: "bill_update"
                };
                try {
                    await axios.post("https://webhook.botpress.cloud/6df86dac-9e27-4939-b82d-1b930b382ee6", webhookData);
                console.log(`✅ Webhook sent for bill ${bill.client_id}: ${bill.convo_id}: ${bill.bill_request_id}: ${bill.bill_status}`);
                } catch (error) {
                    console.error("❌ Webhook failed:", error.response?.data || error.message);
                }
            }
        } catch (err) {
            console.error("❌ Error checking bill status updates:", err);
        }
    }, 5000);
};
