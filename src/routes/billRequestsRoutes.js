// routes/billRequestsRoutes.js
const express = require('express');
const router = express.Router();
const billRequestsController = require('../controllers/billRequestsController');

router.post('/', billRequestsController.createBillRequest);  // Request a bill
router.get('/', billRequestsController.getBillRequests);  // Fetch all bill requests
router.put('/:order_id', billRequestsController.updateBillRequestStatus);

module.exports = router;
