const express = require("express");
const router = express.Router();
const tablesController = require("../controllers/tablesController");

router.put("/update-status", tablesController.updateTableStatus);

module.exports = router;
