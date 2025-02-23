const db = require("../config/db");

exports.updateTableStatus = async (req, res) => {
    try {
        // ✅ Step 1: Validate `table_id`
        const tableId = parseInt(req.body.table_id, 10);
        if (isNaN(tableId)) {
            return res.status(400).json({ error: "Invalid table_id. Must be a number." });
        }

        // ✅ Step 2: Validate `status`
        const status = req.body.status;
        const validStatuses = ["Available", "Occupied"]; // Adjust based on your requirements

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid table_status. Allowed values: ${validStatuses.join(", ")}`
            });
        }

        console.log(`📢 Updating table_id: ${tableId} with status: ${status}`);

        // ✅ Step 3: Update the table status
        const updateQuery = `UPDATE "tables" SET table_status = $1 WHERE table_id = $2 RETURNING *`;
        const result = await db.query(updateQuery, [status, tableId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Table not found." });
        }

        console.log(`✅ Table ${tableId} updated successfully to status: ${status}`);
        res.json({ message: "Table status updated successfully.", table: result.rows[0] });

    } catch (error) {
        console.error("❌ Error updating table status:", error.message);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
