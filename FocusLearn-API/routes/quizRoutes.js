import express from "express";
import { pool } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const router = express.Router();

/**
 * @swagger
 * /api/quizzes:
 *   post:
 *     summary: Generate a new quiz using AI
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - materialId
 *               - selectedText
 *               - pageNumber
 *             properties:
 *               materialId:
 *                 type: integer
 *               selectedText:
 *                 type: string
 *               pageNumber:
 *                 type: integer
 *               contextText:
 *                 type: string
 *     responses:
 *       201:
 *         description: Quiz generated successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { materialId, selectedText, pageNumber, contextText } = req.body;
    const userId = req.user.userId;

    if (!materialId || !selectedText || pageNumber === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const materialQuery = `SELECT id, file_name FROM materials WHERE id = $1 AND user_id = $2`;
    const materialResult = await pool.query(materialQuery, [
      materialId,
      userId,
    ]);

    if (materialResult.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Material not found or unauthorized" });
    }

    const prompt = `You are a professional quiz maker. Based on the following context, generate a quiz in JSON format only. 
Each question should include a 'question', an 'options' array of 4 strings, and a 'correctAnswer' which is the index of the correct option.
Ensure the output is a valid JSON array like this:
[
  {question: '...', options: ['...', '...', '...', '...'], correctAnswer: 2},
  ...
]

Selected Text: "${selectedText}"
${contextText ? `Context: "${contextText}"` : ""}`;

    const result = await model.generateContent(prompt);
    const quizContent = result.response.text();

    let quizJSON;
    try {
      quizJSON = JSON.parse(quizContent);
    } catch (e) {
      console.error("Parsing error:", quizContent);
      return res
        .status(500)
        .json({
          message: "AI response format invalid",
          rawResponse: quizContent,
        });
    }

    const insertQuery = `
      INSERT INTO quizzes (user_id, material_id, quiz_data, page_number, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, quiz_data, page_number, created_at
    `;

    const insertResult = await pool.query(insertQuery, [
      userId,
      materialId,
      quizJSON,
      pageNumber,
    ]);

    res.status(201).json({
      message: "Quiz created successfully",
      quiz: insertResult.rows[0],
    });
  } catch (error) {
    console.error("Create quiz error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/quizzes/submit:
 *   post:
 *     summary: Submit a completed quiz
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - materialId
 *               - quizData
 *             properties:
 *               materialId:
 *                 type: integer
 *               quizData:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Quiz submitted and saved successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
router.post("/submit", verifyToken, async (req, res) => {
  try {
    const { materialId, quizData } = req.body;
    const userId = req.user.userId;

    if (!materialId || !quizData) {
      return res
        .status(400)
        .json({ message: "Missing required fields: materialId or quizData" });
    }

    const insertQuery = `
    INSERT INTO quizzes (user_id, material_id, quiz_data, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING id
  `;
    const insertValues = [userId, materialId, JSON.stringify(quizData)];
    const result = await pool.query(insertQuery, insertValues);

    res
      .status(201)
      .json({
        message: "Quiz submitted successfully",
        quizId: result.rows[0].id,
      });
  } catch (error) {
    console.error("Submit quiz error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/quizzes:
 *   get:
 *     summary: Get all quizzes for the user
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All quizzes retrieved
 *       500:
 *         description: Server error
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      `
      SELECT id, quiz_data, material_id, page_number, created_at, updated_at
      FROM quizzes WHERE user_id = $1 ORDER BY created_at DESC
    `,
      [userId]
    );

    res
      .status(200)
      .json({
        message: "Quizzes retrieved successfully",
        quizzes: result.rows,
      });
  } catch (error) {
    console.error("Get quizzes error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/quizzes/{quizId}:
 *   get:
 *     summary: Get a specific quiz by ID
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The quiz ID
 *     responses:
 *       200:
 *         description: Quiz retrieved successfully
 *       404:
 *         description: Quiz not found
 *       500:
 *         description: Server error
 */
router.get("/:quizId", verifyToken, async (req, res) => {
  try {
    const quizId = parseInt(req.params.quizId);
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT id, quiz_data, material_id, page_number, created_at, updated_at
      FROM quizzes WHERE id = $1 AND user_id = $2
    `,
      [quizId, userId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Quiz not found or unauthorized" });
    }

    res
      .status(200)
      .json({ message: "Quiz retrieved successfully", quiz: result.rows[0] });
  } catch (error) {
    console.error("Get quiz error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
