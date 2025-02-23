const db = require('../config/db');

exports.createBillRequest = async (req, res) => {
    try {
        const { order_id, table_id } = req.body;

        // ✅ Step 1: Validate order_id
        if (!order_id) {
            return res.status(400).json({ error: "order_id is required" });
        }
        console.log("📦 Received order_id:", order_id);

        // ✅ Step 2: Check if the order exists and fetch its status and table_id
        const orderCheck = await db.query(
            'SELECT "order_status", "table_id" FROM "customer_orders" WHERE "order_id" = $1',
            [order_id]
        );

        console.log("🔍 Order Lookup Result:", orderCheck.rows);

        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        const orderStatus = orderCheck.rows[0].order_status;  // 🔹 Fix: Correctly accessing lowercase column name
        let finalTableId = table_id || orderCheck.rows[0].table_id;  // 🔹 Fix: Correct case for "table_id"

        console.log(`🔎 Order Status for Order_ID ${order_id}: ${orderStatus}`);
        console.log(`🔎 Table ID for Order_ID ${order_id}: ${finalTableId}`);

        // ✅ Step 3: Ensure the order status is 'Active'
        if (orderStatus.toLowerCase() !== 'active') {
            return res.status(400).json({
                error: `Bill request is only allowed for orders with status 'Active'. Current status: '${orderStatus}'`
            });
        }

        // ✅ Step 4: Validate table_id
        if (!finalTableId) {
            return res.status(400).json({ error: "Table ID is required for bill request" });
        }

        // ✅ Step 5: Check if at least one session is 'Completed'
        const sessionCheck = await db.query(
            `SELECT COUNT(*) FROM "order_sessions" WHERE "order_id" = $1 AND "session_status" = 'Completed'`,
            [order_id]
        );

        const completedSessionsCount = parseInt(sessionCheck.rows[0].count, 10);
        console.log(`🔎 Completed Sessions for Order_ID ${order_id}:`, completedSessionsCount);

        if (completedSessionsCount === 0) {
            return res.status(400).json({ error: "At least one session must be 'Completed' before requesting the bill." });
        }

        // ✅ Step 6: Insert the bill request
        const result = await db.query(
            'INSERT INTO "bill_requests" ("order_id", "table_id", "bill_status") VALUES ($1, $2, $3) RETURNING *',
            [order_id, finalTableId, 'Pending']
        );

        console.log(`✅ Bill request created for Order_ID ${order_id}`, result.rows[0]);
        res.status(201).json({
            message: "Bill request submitted successfully!",
            billRequest: result.rows[0]
        });

    } catch (err) {
        console.error("🚨 Database error:", err.message);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
};

exports.getBillRequests = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM Bill_Requests');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


exports.updateBillRequestStatus = async (req, res) => { 
    try {
        const { order_id } = req.params;  // Correct case
        const { bill_status } = req.body;  // Correct case

        const result = await db.query(
            'UPDATE Bill_Requests SET Bill_Status = $1 WHERE Order_id = $2 RETURNING *',
            [bill_status, order_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bill request not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


