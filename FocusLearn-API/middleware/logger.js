// middleware/logger.js
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json() // For file logs, keep JSON format
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Add colors for better visibility
        winston.format.printf(({ timestamp, level, message }) => {
          // Custom readable format for console
          const formattedMessage =
            typeof message === "object"
              ? JSON.stringify(message, null, 2) // Pretty-print objects with 2-space indentation
              : message;
          return `${timestamp} [${level}]: ${formattedMessage}`;
        })
      ),
    }),
  ],
});

export default logger;