// controllers/userController.js
const db = require('../config/db');

exports.createUser = async (req, res) => {
    try {
        const { client_id, name, mail_id } = req.body;
        const result = await db.query(
            'INSERT INTO User_Details (Client_ID, Name, Mail_ID) VALUES ($1, $2, $3) RETURNING *',
            [client_id, name, mail_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const { client_id } = req.params;
        const result = await db.query(
            'SELECT * FROM User_Details WHERE Client_ID = $1',
            [client_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM User_Details');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { client_id } = req.params;
        const { name, mail_id } = req.body;
        const result = await db.query(
            'UPDATE User_Details SET Name = $1, Mail_ID = $2, Updated_At = CURRENT_TIMESTAMP WHERE Client_ID = $3 RETURNING *',
            [name, mail_id, client_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
