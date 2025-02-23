const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
    console.log("Received Bill Update Webhook:", req.body);

    // Extract data from the webhook payload
    const { orderId,billRequestId,newStatus } = req.body;

    // Process the webhook (e.g., log it, trigger actions, etc.)
    console.log(`Bill ${billRequestId} for order ${orderId} is now ${newStatus}`);

    // Respond to the webhook sender (Botpress)
    res.status(200).send("Bill update received.");
});

module.exports = router;
