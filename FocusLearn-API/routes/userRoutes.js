import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.get("/auth", async (req, res) => {
    try {
      console.log("Cookies received in /auth:", req.cookies); // Debug
  
      const token = req.cookies.authToken; // Read the cookie
      if (!token) {
        console.log("No token found in cookies!");
        return res.status(401).json({ error: "Unauthorized: No token" });
      }
  
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded); // Debug token data
  
      const user = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [decoded.userId]);
  
      if (user.rows.length === 0) {
        console.log("User not found in DB!");
        return res.status(401).json({ error: "User not found" });
      }
  
      res.json(user.rows[0]);
    } catch (error) {
      console.error("JWT Verification Error:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
  
  
export default router;