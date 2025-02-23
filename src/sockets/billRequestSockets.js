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
                    SELECT br.bill_request_id, br.order_id, br.requested_at, br.bill_status, t.table_number, t.table_status
                    FROM Bill_Requests br
                    JOIN Tables t ON br.table_id = t.table_id
                    ORDER BY br.requested_at DESC
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
            const statusResult = await db.query(`SELECT bill_request_id, order_id, bill_status FROM Bill_Requests WHERE bill_status IN ('Generated')`);
            for (const bill of statusResult.rows) {
                const webhookData = { orderId: bill.order_id, billRequestId: bill.bill_request_id, newStatus: bill.bill_status };
                try {
                    await axios.post("https://present-karena-cpprestomania-99c22f9c.koyeb.app/webhook/bill-update", webhookData);
                    console.log(`✅ Webhook sent for bill ${bill.bill_request_id}: ${bill.bill_status}`);
                } catch (error) {
                    console.error("❌ Webhook failed:", error.response?.data || error.message);
                }
            }
        } catch (err) {
            console.error("❌ Error checking bill status updates:", err);
        }
    }, 5000);
};
