// routes/tastePaletteRoutes.js
const express = require('express');
const router = express.Router();
const tastePaletteController = require('../controllers/tastePaletteController');

router.post('/', tastePaletteController.createTastePalette);  // Add taste preferences
router.get('/:client_id', tastePaletteController.getTastePaletteByUser);  // Fetch preferences by user
router.put('/:client_id', tastePaletteController.updateTastePalette);  // Update preferences

module.exports = router;
