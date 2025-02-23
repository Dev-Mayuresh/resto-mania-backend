const db = require('../config/db');

exports.createBillRequest = async (req, res) => {
    try {
        const { order_id } = req.body;

        // ✅ Step 1: Check if the order exists and has the correct status
        const orderCheck = await db.query(
            'SELECT Order_Status FROM Customer_Orders WHERE Order_ID = $1',
            [order_id]
        );

        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        const orderStatus = orderCheck.rows[0].order_status;
        console.log(`🔎 Order Status for Order_ID ${order_id}:`, orderStatus); // Debugging log

        // ✅ Step 2: Ensure the order status is 'Active'
        if (orderStatus !== 'Active') {
            return res.status(400).json({ error: `Bill request is only allowed for orders with status 'Active'. Current status: '${orderStatus}'` });
        }

        // ✅ Step 3: Check if at least one session is 'Completed'
        const sessionCheck = await db.query(
            `SELECT COUNT(*) FROM order_sessions WHERE Order_ID = $1 AND Session_Status = 'Completed'`,
            [order_id]
        );

        const completedSessionsCount = parseInt(sessionCheck.rows[0].count, 10);
        console.log(`🔎 Completed Sessions for Order_ID ${order_id}:`, completedSessionsCount); // Debugging log

        if (completedSessionsCount === 0) {
            return res.status(400).json({ error: "At least one session must be 'Completed' before requesting the bill." });
        }

        // ✅ Step 4: Insert the bill request
        const result = await db.query(
            'INSERT INTO Bill_Requests (Order_ID, Bill_Status) VALUES ($1, $2) RETURNING *',
            [order_id, 'Pending']
        );

        console.log(`✅ Bill request created for Order_ID ${order_id}`); // Debugging log
        res.status(201).json({ message: "Bill request submitted successfully!", billRequest: result.rows[0] });

    } catch (err) {
        console.error("🚨 Database error:", err); // Debugging log
        res.status(500).json({ error: err.message });
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


