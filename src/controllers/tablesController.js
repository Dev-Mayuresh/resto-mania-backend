const db = require("../config/db");

exports.updateTableStatus = async (req, res) => {
    const { table_id, status } = req.body;

    try {
        const updateQuery = `UPDATE Tables SET table_status = $1 WHERE table_id = $2 RETURNING *`;
        const result = await db.query(updateQuery, [status, table_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Table not found." });
        }

        res.json({ message: "Table status updated successfully.", table: result.rows[0] });
    } catch (error) {
        console.error("❌ Error updating table status:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};
