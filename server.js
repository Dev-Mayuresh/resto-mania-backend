require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const { Server } = require("socket.io");
const db = require("./src/config/db");

// Import API routes
const ordersRoutes = require("./src/routes/ordersRoutes");
const billRequestsRoutes = require("./src/routes/billRequestsRoutes");
const userRoutes = require("./src/routes/userRoutes");
const tastePaletteRoutes = require("./src/routes/tastePaletteRoutes");
const tablesRoutes = require("./src/routes/tablesRoutes"); // ✅ Added table tracking API
const feedbackRoutes = require("./src/routes/feedbackRoutes");


// Import socket handlers
const orderSockets = require("./src/sockets/orderSockets");
const billRequestSockets = require("./src/sockets/billRequestSockets");
const tablesSockets = require("./src/sockets/tablesSockets"); // ✅ Added table tracking socket

// Import webhooks
const orderWebhook = require("./src/webhooks/orderWebhook");
const billWebhook = require("./src/webhooks/billWebhook");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*"||"https://present-karena-cpprestomania-99c22f9c.koyeb.app" // Restrict CORS in production
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(helmet({ crossOriginResourcePolicy: false }));

// ✅ API Routes
app.use("/api/orders", ordersRoutes);
app.use("/api/bill-requests", billRequestsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/taste-palette", tastePaletteRoutes);
app.use("/api/tables", tablesRoutes); // ✅ Added table tracking API
app.use("/api/feedback", feedbackRoutes);

// ✅ Webhook Routes
app.use("/webhook/order-update", orderWebhook);
app.use("/webhook/bill-update", billWebhook);

// ✅ WebSocket connection events
io.on("connection", (socket) => {
    console.log(`🟢 WebSocket connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
        console.log(`🔴 WebSocket disconnected: ${socket.id}, Reason: ${reason}`);
    });

    socket.on("error", (error) => {
        console.error("❌ WebSocket Error:", error.message);
    });
});

// Initialize WebSocket handlers
orderSockets(io, db);
billRequestSockets(io, db);
tablesSockets(io, db); // ✅ Added table tracking WebSocket

// ✅ Global Error Handler
app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err.stack || err.message);
    res.status(500).json({ message: "Internal Server Error" });
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});

