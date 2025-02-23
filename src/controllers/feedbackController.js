// feedbackController.js

const db = require("../config/db");

// ✅ Add new feedback
exports.addFeedback = async (req, res) => {
    const { client_id, feedback_text } = req.body;

    if (!client_id || !feedback_text) {
        return res.status(400).json({ message: "Client ID and feedback text are required." });
    }

    try {
        const result = await db.query(
            `INSERT INTO Feedback (client_id, feedback_text, created_at) 
             VALUES ($1, $2, NOW()) RETURNING *`,
            [client_id, feedback_text]
        );
        res.status(201).json({ message: "Feedback submitted successfully!", feedback: result.rows[0] });
    } catch (error) {
        console.error("❌ Error adding feedback:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// ✅ Get all feedback
exports.getAllFeedback = async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM Feedback ORDER BY created_at DESC`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("❌ Error fetching feedback:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// ✅ Get feedback by client ID
exports.getFeedbackByClient = async (req, res) => {
    const { client_id } = req.params;

    try {
        const result = await db.query(`SELECT * FROM Feedback WHERE client_id = $1 ORDER BY created_at DESC`, [client_id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("❌ Error fetching client feedback:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// ✅ Delete feedback
exports.deleteFeedback = async (req, res) => {
    const { feedback_id } = req.params;

    try {
        await db.query(`DELETE FROM Feedback WHERE feedback_id = $1`, [feedback_id]);
        res.status(200).json({ message: "Feedback deleted successfully!" });
    } catch (error) {
        console.error("❌ Error deleting feedback:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
