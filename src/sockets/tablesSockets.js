
module.exports = (io, db) => {
    let activeSockets = new Set();
    let tableStatusInterval = null;

    io.on("connection", (socket) => {
        console.log(`🟢 User connected: ${socket.id}`);
        activeSockets.add(socket.id);

        // ✅ Fetch and emit table statuses
        const fetchTableStatuses = async () => {
            if (activeSockets.size === 0) return;
            try {
                console.log("🔍 Fetching table statuses...");
                const tableResult = await db.query(`SELECT * FROM Tables ORDER BY table_number ASC`);
                io.emit("loadTableStatuses", tableResult.rows);
            } catch (err) {
                console.error("❌ Error fetching table statuses:", err);
            }
        };

        if (!tableStatusInterval) tableStatusInterval = setInterval(fetchTableStatuses, 5000);

        socket.on("disconnect", () => {
            console.log(`🔴 User disconnected: ${socket.id}`);
            activeSockets.delete(socket.id);
            if (activeSockets.size === 0) {
                clearInterval(tableStatusInterval);
                tableStatusInterval = null;
                console.log("⏸ Stopped polling as no users are connected.");
            }
        });
    });
};
