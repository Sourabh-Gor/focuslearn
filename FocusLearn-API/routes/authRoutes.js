//authRoutes.js code

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import { verifyToken } from "../middleware/auth.js";

dotenv.config();
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists
 *       500:
 *         description: Server error
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const userExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user into DB
    const newUser = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and return a token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful, returns a JWT token
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.rows[0].last_login === null) {
      let _ = await pool.query(
        "UPDATE users SET last_login = NOW() WHERE email = $1 RETURNING *",
        [email]
      );
      firstTimeLogin = true;
    }

    // Generate JWT Token
    const token = jwt.sign(
      { userId: user.rows[0].id, email: user.rows[0].email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set JWT in an HTTP-only cookie
    res.cookie("authToken", token, {
      httpOnly: true, // Prevent client-side access
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      sameSite: "Strict", // Prevent CSRF
      maxAge: 3600000, // 1 hour expiration
    });

    res.cookie("firstTimeLogin", firstTimeLogin, {
      httpOnly: true, // Prevent client-side access
      secure: false, // Use secure cookies in production
      sameSite: "Strict", // Prevent CSRF
    });

    res.json({ message: "Login successful" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/protected:
 *   get:
 *     summary: Access a protected route (requires authentication)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Protected route accessed
 *       401:
 *         description: Unauthorized
 */
router.get("/protected", verifyToken, (req, res) => {
  res.json({ message: "Protected route accessed!", user: req.user });
});

router.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
router.use(passport.initialize());
router.use(passport.session());

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // callbackURL: `${process.env.GOOGLE_CALLBACK_URL}`,
      callbackURL: "http://localhost:5000/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await pool.query("SELECT * FROM users WHERE email = $1", [
          email,
        ]);

        if (user.rows.length === 0) {
          user = await pool.query(
            "INSERT INTO users (name, email, password, google_id, last_login) VALUES ($1, $2, $3, $4, NULL) RETURNING *",
            [profile.displayName, email, null, profile.id]
          );
        }
        return done(null, user.rows[0]);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  done(null, user.rows[0]);
});

// Google Auth Route
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google Auth Callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    let firstTimeLogin = false;

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [
      req.user.email,
    ]);

    if (user.rows[0].last_login === null) {
      let _ = await pool.query(
        "UPDATE users SET last_login = NOW() WHERE email = $1 RETURNING *",
        [user.email]
      );
      firstTimeLogin = true;
    }

    // Set JWT in an HTTP-only cookie
    res.cookie("authToken", token, {
      httpOnly: true, // Prevent client-side access
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      sameSite: "Strict", // Prevent CSRF
      maxAge: 3600000, // 1 hour expiration
    });

    res.cookie("firstTimeLogin", firstTimeLogin, {
      httpOnly: true, // Prevent client-side access
      secure: false, // Use secure cookies in production
      sameSite: "Strict", // Prevent CSRF
    });

    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  }
);

/**
 * @swagger
 * /api/auth/logout:
 *   get:
 *     summary: Logout user
 *     tags: [Authentication]
 */
router.get("/logout", (req, res) => {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
  });
  res.json({ message: "Logged out successfully" });
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 */
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await pool.query(
      "SELECT id, email, name, google_id, created_at, last_login, onboarding_completed FROM users WHERE id = $1",
      [req.user.userId]
    );

    const prefResult = await pool.query(
      'SELECT initial_attention_span, preferred_study_time, common_distractions, avg_study_duration FROM user_preferences WHERE user_id = $1',
      [req.user.userId]
  );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
            ...user.rows[0],
            preferences: prefResult.rows[0] || {}
        });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/check-auth", (req, res) => {
  const token = req.cookies.authToken;
  if (!token) {
    return res.status(401).json({ isAuthenticated: false });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      isAuthenticated: true,
      user: {
        id: decoded.userId, // Matches the 'userId' field in the token
        email: decoded.email, // Matches the 'email' field in the token
      },
    });
  } catch (err) {
    // Token is invalid or expired
    res.status(401).json({ isAuthenticated: false });
  }
});

export default router;
