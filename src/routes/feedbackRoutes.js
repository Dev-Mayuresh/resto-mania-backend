// feedbackRoutes.js

const express = require("express");
const router = express.Router();
const feedbackController = require("../controllers/feedbackController");

// ✅ Add feedback
router.post("/", feedbackController.addFeedback);

// ✅ Get all feedback
router.get("/", feedbackController.getAllFeedback);

// ✅ Get feedback by client ID
router.get("/:client_id", feedbackController.getFeedbackByClient);

// ✅ Delete feedback by ID
router.delete("/:feedback_id", feedbackController.deleteFeedback);

module.exports = router;
