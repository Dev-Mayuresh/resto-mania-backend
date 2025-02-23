const db = require('../config/db');
exports.createOrder = async (req, res) => {
    try {
        const { client_id, items, session_id, order_id, table_id } = req.body; // ✅ API must send `order_id`

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Order must contain at least one item." });
        }

        // ✅ Step 1: Check if the table exists and fetch its status
        const tableQuery = `SELECT table_status, customer_count FROM Tables WHERE table_id = $1`;
        const tableResult = await db.query(tableQuery, [table_id]);

        if (tableResult.rows.length === 0) {
            return res.status(400).json({ error: "Invalid table ID" });
        }

        const { table_status, customer_count } = tableResult.rows[0];

        // ✅ Step 2: Ensure table is available or not full (max 2 customers)
        if (table_status === 'Available' || customer_count <= 2) {
            // ✅ Step 3: Insert the API-generated order_id into Customer_Orders
            await db.query(
                `INSERT INTO Customer_Orders (Order_ID, Client_ID, Table_ID, Order_Status) 
                 VALUES ($1, $2, $3, 'Processing') 
                 ON CONFLICT (Order_ID) DO NOTHING;`, 
                [order_id, client_id, table_id]
            );

            // ✅ Step 4: Insert session into Order_Sessions (if not exists)
            await db.query(
                `INSERT INTO Order_Sessions (Session_ID, Order_ID, Session_Status) 
                 VALUES ($1, $2, 'Pending')
                 ON CONFLICT (Session_ID) DO NOTHING;`,
                [session_id, order_id]
            );

            // ✅ Step 5: Fetch menu_item_ids from Menu_Items based on item names
            const menuItemMap = await getMenuItemIds(items);

            // ✅ Step 6: Insert items into Order_Items
            const orderItemsQuery = `
                INSERT INTO Order_Items (Order_ID, Menu_Item_ID, Quantity, Session_ID)
                VALUES ${items.map(item => `(${order_id}, ${menuItemMap[item.item_name]}, ${item.quantity}, '${session_id}')`).join(',')}
                RETURNING *;
            `;    
            const orderItemsResult = await db.query(orderItemsQuery);

            // ❌ Removed manual customer_count update (handled by the trigger)

            // ✅ Step 7: Return success message
            res.status(201).json({
                message: "Order placed successfully!",
                session_id, // ✅ Only returning session_id
                items: orderItemsResult.rows
            });

        } else {
            return res.status(400).json({ error: "Table is full (maximum 4 customers allowed)." });
        }

    } catch (err) {
        console.error("🚨 Error in createOrder:", err);
        res.status(500).json({ error: err.message });
    }
};

// ✅ Helper function to fetch menu_item_ids
const getMenuItemIds = async (items) => {
    const itemNames = items.map(item => item.item_name);
    const menuItemQuery = `
        SELECT Menu_Item_ID, Item_Name 
        FROM Menu_Items 
        WHERE Item_Name = ANY($1);
    `;
    const menuItemResult = await db.query(menuItemQuery, [itemNames]);

    if (menuItemResult.rows.length !== items.length) {
        throw new Error("Some menu items were not found in the database.");
    }

    // Convert to a mapping object { "Pizza": 5, "Coke": 7 }
    return menuItemResult.rows.reduce((acc, row) => {
        acc[row.item_name] = row.menu_item_id;
        return acc;
    }, {});
};

exports.getOrderById = async (req, res) => {
    try {
        const { order_id } = req.params;

        const orderQuery = `
            SELECT CO.Order_ID, CO.Client_ID, CO.Order_Status, 
                   OI.Menu_Item_ID, MI.Item_Name, OI.Quantity
            FROM Customer_Orders CO
            JOIN Order_Items OI ON CO.Order_ID = OI.Order_ID
            JOIN Menu_Items MI ON OI.Menu_Item_ID = MI.Menu_Item_ID
            WHERE CO.Order_ID = $1;
        `;
        const result = await db.query(orderQuery, [order_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        const order = {
            order_id: result.rows[0].order_id,
            client_id: result.rows[0].client_id,
            order_status: result.rows[0].order_status,
            items: result.rows.map(row => ({
                menu_item_id: row.menu_item_id,
                item_name: row.item_name,
                quantity: row.quantity
            }))
        };

        res.status(200).json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


exports.updateOrderStatus = async (req, res) => {
    try {
        const { order_id } = req.params;
        const { order_status } = req.body;

        const result = await db.query(
            'UPDATE Customer_Orders SET Order_Status = $1, Updated_At = CURRENT_TIMESTAMP WHERE Order_ID = $2 RETURNING *',
            [order_status, order_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error updating order status:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.updateSessionStatus = async (req, res) => {
    try {
        const { order_id, session_id } = req.params;
        const { session_status } = req.body;

        // ✅ Define valid session statuses
        const validStatuses = ['Pending', 'Accepted', 'Declined', 'Cancelled','Completed'];
        if (!validStatuses.includes(session_status)) {
            return res.status(400).json({ error: "Invalid session status." });
        }

        // ✅ Fetch the current session status
        const sessionResult = await db.query(
            `SELECT session_status FROM order_sessions WHERE order_id = $1 AND session_id = $2;`,
            [order_id, session_id]
        );

        // ✅ Check if session exists
        if (sessionResult.rowCount === 0) {
            return res.status(404).json({ error: "Session not found." });
        }

        const currentStatus = sessionResult.rows[0].session_status;

        // ✅ Prevent cancellation if session is already Accepted or Declined
        if (session_status === 'Cancelled' && (currentStatus === 'Accepted' || currentStatus === 'Declined'|| currentStatus === 'Completed')) {
            return res.status(400).json({ error: `Session cannot be cancelled as it is already '${currentStatus}'.` });
        }

        // ✅ Update the session status in the database
        const updateResult = await db.query(
            `UPDATE order_sessions 
             SET session_status = $1 
             WHERE order_id = $2 AND session_id = $3 
             RETURNING *;`,
            [session_status, order_id, session_id]
        );

        res.status(200).json({ 
            message: "Session status updated successfully!", 
            updatedSession: updateResult.rows[0] 
        });

    } catch (err) {
        console.error("🚨 Error updating session status:", err);
        res.status(500).json({ error: err.message });
    }
};
