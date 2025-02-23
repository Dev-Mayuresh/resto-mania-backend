// routes/ordersRoutes.js
const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');

router.post('/', ordersController.createOrder);  // Place a new order
router.get('/:order_id', ordersController.getOrderById);  // Fetch orders by id
router.put('/:order_id', ordersController.updateOrderStatus);  // Update order status
router.put('/:order_id/:session_id', ordersController.updateSessionStatus); // Update session status

module.exports = router;

 