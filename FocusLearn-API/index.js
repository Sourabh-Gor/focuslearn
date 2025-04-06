import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import pkg from "pg";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import cookieParser from "cookie-parser";
import logger from "./middleware/logger.js";
import { verifyToken } from "./middleware/auth.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import onboardingRoutes from "./routes/onboardingRoutes.js";
import materialsRoutes from "./routes/materialsRoutes.js";
import flashcardRoutes from "./routes/flashcardRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";

dotenv.config();
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 5000;

// PostgreSQL Connection Setup
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Test Database Connection
pool
  .connect()
  .then(() => console.log("✅ Connected to PostgreSQL Database"))
  .catch((err) => {
    console.error("❌ Database Connection Error:", err)
    process.exit(1);
  });

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL, // Allow frontend URL
    credentials: true, // Allow sending cookies
  })
);
app.use(cookieParser()); // **Must be before route handlers**

// Custom Logging Middleware with Non-Blocking Token Verification
app.use((req, res, next) => {
  const startTime = Date.now();

  // Non-blocking token verification for logging purposes
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Extract token after "Bearer"

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.userId, email: decoded.email }; // Set req.user if token is valid
    } catch (error) {
      logger.warn({
        message: "Invalid or expired token in request",
        tokenError: error.message,
        url: req.url,
        method: req.method,
      });
      req.user = null; // Token invalid, set req.user to null
    }
  } else {
    req.user = null; // No token, set req.user to null
  }

  // Capture the original res.json function
  const originalJson = res.json;

  // Override res.json to log the response
  res.json = function (body) {
    const user = req.user ? req.user.id : "anonymous";
    const duration = Date.now() - startTime;

    logger.info({
      method: req.method,
      url: req.url,
      user: user,
      status: res.statusCode,
      response: body,
      duration: `${duration}ms`,
    });

    return originalJson.call(this, body);
  };

  // Log errors if they occur
  res.on("error", (err) => {
    logger.error({
      method: req.method,
      url: req.url,
      user: req.user ? req.user.id : "anonymous",
      error: err.message,
    });
  });

  next(); // Always proceed to the next middleware
});

// Swagger Setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FocusLearn API",
      version: "1.0.0",
      description: "API for the FocusLearn application",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./routes/*.js"],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/materials", materialsRoutes);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/quizzes", quizRoutes);
// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
