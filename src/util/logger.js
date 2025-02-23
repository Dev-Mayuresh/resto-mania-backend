// utils/logger.js
const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '../logs/server.log');

const logger = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // Append log message to server.log
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error("Error writing to log file:", err);
        }
    });

    console.log(logMessage);
};

module.exports = logger;
