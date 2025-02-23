const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
    console.log("Received Order Update Webhook:", req.body);

    // Extract data from the webhook payload
    const { orderId,sessionId ,newStatus } = req.body;

    // Process the webhook (e.g., log it, trigger actions, etc.)
    console.log(`Order ${orderId} for session ${sessionId} is now ${newStatus}`);

    // Respond to the webhook sender (Botpress)
    res.status(200).send("Order update received.");
});

module.exports = router;
