// controllers/tastePaletteController.js
const db = require('../config/db');

exports.createTastePalette = async (req, res) => {
    try {
        const { client_id, fav_cuisine, fav_dish, restrictions, allergies, spiciness } = req.body;
        const result = await db.query(
            'INSERT INTO Taste_palette (Client_ID, Fav_cuisine, Fav_Dish, Restrictions, Allergies, Spiciness) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [client_id, fav_cuisine, fav_dish, restrictions, allergies, spiciness]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getTastePaletteByUser = async (req, res) => {
    try {
        const { client_id } = req.params;
        console.log("Received request for client_id:", client_id);

        const result = await db.query(
            'SELECT * FROM Taste_palette WHERE Client_ID = $1',
            [client_id]
        );

        console.log("Database query result:", result.rows);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Taste palette not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching taste palette:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.updateTastePalette = async (req, res) => {
    try {
        const { client_id } = req.params;
        const { fav_cuisine, fav_dish, restrictions, allergies, spiciness } = req.body;
        const result = await db.query(
            'UPDATE Taste_palette SET Fav_cuisine = $1, Fav_Dish = $2, Restrictions = $3, Allergies = $4, Spiciness = $5 WHERE Client_ID = $6 RETURNING *',
            [fav_cuisine, fav_dish, restrictions, allergies, spiciness, client_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Taste palette not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
