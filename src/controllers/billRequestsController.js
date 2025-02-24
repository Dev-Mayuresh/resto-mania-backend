const db = require('../config/db');

exports.createBillRequest = async (req, res) => {
    try {
        const { order_id, table_id } = req.body;

        // ✅ Validate order_id
        if (!order_id) {
            return res.status(400).json({ error: "order_id is required" });
        }

        console.log("📦 Received order_id:", order_id);

        // ✅ Check if the order exists and fetch its status and table_id
        const orderCheck = await db.query(
            `SELECT order_status, table_id FROM customer_orders WHERE order_id = $1`,
            [order_id]
        );

        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        const orderStatus = orderCheck.rows[0].order_status;
        let finalTableId = table_id || orderCheck.rows[0].table_id;

        // ✅ Ensure the order status is 'Active'
        if (orderStatus.toLowerCase() !== 'active') {
            return res.status(400).json({
                error: `Bill request is only allowed for orders with status 'Active'. Current status: '${orderStatus}'`
            });
        }

        // ✅ Validate table_id
        if (!finalTableId) {
            return res.status(400).json({ error: "Table ID is required for bill request" });
        }

        // ✅ Fetch Completed Sessions for the Order
        const completedSessions = await db.query(
            `SELECT session_id FROM order_sessions WHERE order_id = $1 AND session_status = 'Completed'`,
            [order_id]
        );

        if (completedSessions.rows.length === 0) {
            return res.status(400).json({ error: "At least one session must be 'Completed' before requesting the bill." });
        }

        // ✅ Extract completed session IDs
        const completedSessionIds = completedSessions.rows.map(row => row.session_id);

        // ✅ Fetch Items and Quantities from Completed Sessions (JOIN with menu_items)
        const itemsQuery = await db.query(
            `SELECT oi.session_id, mi.item_name, oi.quantity
             FROM order_items oi
             JOIN menu_items mi ON oi.menu_item_id = mi.menu_item_id
             WHERE oi.session_id = ANY($1)`,
            [completedSessionIds]
        );

        // ✅ Group Items by Session ID
        const sessionItems = {};
        itemsQuery.rows.forEach(row => {
            if (!sessionItems[row.session_id]) {
                sessionItems[row.session_id] = [];
            }
            sessionItems[row.session_id].push({
                item_name: row.item_name,
                quantity: row.quantity
            });
        });

        // ✅ Structure Completed Session Data with Items and Quantities
        const completedSessionDetails = completedSessionIds.map(session_id => ({
            session_id,
            items: sessionItems[session_id] || []  // If no items, return an empty array
        }));

        // ✅ Insert the Bill Request into the Database
        const result = await db.query(
            `INSERT INTO bill_requests (order_id, table_id, bill_status) VALUES ($1, $2, $3) RETURNING *`,
            [order_id, finalTableId, 'Pending']
        );

        console.log(`✅ Bill request created for Order_ID ${order_id}`, result.rows[0]);

        // ✅ Return the Response with Completed Sessions, Items, and Quantities
        res.status(201).json({
            message: "Bill request submitted successfully!",
            billRequest: {
                ...result.rows[0],
                completed_sessions: completedSessionDetails
            }
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


