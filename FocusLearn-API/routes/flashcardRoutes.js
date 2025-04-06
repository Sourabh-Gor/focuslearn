import express from "express";
import { pool } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Google Generative AI client (Gemini)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const router = express.Router();

/**
 * @swagger
 * /api/flashcards:
 *   post:
 *     summary: Create a new flashcard with AI-generated content
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
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
 *         description: Flashcard created successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { materialId, selectedText, pageNumber, contextText } = req.body;
    const userId = req.user.userId;

    // Input validation
    if (!materialId || !selectedText || pageNumber === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verify material exists and belongs to the user
    const materialQuery = `
      SELECT id, file_name FROM materials WHERE id = $1 AND user_id = $2
    `;
    const materialResult = await pool.query(materialQuery, [
      materialId,
      userId,
    ]);

    if (materialResult.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Study material not found or unauthorized" });
    }

    // Generate AI explanation using Gemini
    let backContent = "";
    try {
      const prompt = `You are an expert educator creating high-quality flashcards.  
        Generate a concise and informative explanation or definition for the given term, ensuring it is useful even if context is limited.  
        
        Study document: "${materialResult.rows[0].file_name}"  
        Selected term: "${
          selectedText || "general concept related to the document"
        }"  
        
        ${
          contextText
            ? `Context: "${contextText}"`
            : "If context is missing, infer meaning based on general knowledge."
        }  
        
        Ensure the explanation is clear, precise, and educational, keeping it within 30 words.`;

      const result = await model.generateContent(prompt);
      backContent = result.response.text();
    } catch (error) {
      console.error("AI generation error:", error);
      backContent =
        "Failed to generate AI explanation. Please edit this manually.";
    }

    // Save flashcard to database
    const query = `
      INSERT INTO flashcards (user_id, material_id, front_content, back_content, page_number, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, front_content, back_content, page_number, created_at
    `;

    const values = [userId, materialId, selectedText, backContent, pageNumber];
    const result = await pool.query(query, values);

    res.status(201).json({
      message: "Flashcard created successfully",
      flashcard: result.rows[0],
    });
  } catch (error) {
    console.error("Create flashcard error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/flashcards/{flashcardId}:
 *   put:
 *     summary: Update an existing flashcard
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     parameters:
 *       - in: path
 *         name: flashcardId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The flashcard ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frontContent:
 *                 type: string
 *               backContent:
 *                 type: string
 *     responses:
 *       200:
 *         description: Flashcard updated successfully
 *       403:
 *         description: Unauthorized to update this flashcard
 *       404:
 *         description: Flashcard not found
 *       500:
 *         description: Server error
 */
router.put("/:flashcardId", verifyToken, async (req, res) => {
  try {
    const flashcardId = parseInt(req.params.flashcardId);
    const { frontContent, backContent } = req.body;
    const userId = req.user.userId;

    if (isNaN(flashcardId)) {
      return res.status(400).json({ message: "Invalid flashcard ID" });
    }

    // Update query with validation that user owns this flashcard
    const query = `
      UPDATE flashcards
      SET 
        front_content = COALESCE($1, front_content),
        back_content = COALESCE($2, back_content),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING id, front_content, back_content, page_number, created_at, updated_at
    `;

    const values = [frontContent, backContent, flashcardId, userId];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Flashcard not found or unauthorized" });
    }

    res.status(200).json({
      message: "Flashcard updated successfully",
      flashcard: result.rows[0],
    });
  } catch (error) {
    console.error("Update flashcard error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/flashcards/material/{materialId}:
 *   get:
 *     summary: Get all flashcards for a specific study material
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     parameters:
 *       - in: path
 *         name: materialId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The material ID
 *     responses:
 *       200:
 *         description: List of flashcards
 *       500:
 *         description: Server error
 */
router.get("/material/:materialId", verifyToken, async (req, res) => {
  try {
    const materialId = parseInt(req.params.materialId);
    const userId = req.user.userId;

    if (isNaN(materialId)) {
      return res.status(400).json({ message: "Invalid material ID" });
    }

    const query = `
      SELECT f.id, f.front_content, f.back_content, f.page_number, f.created_at, f.updated_at
      FROM flashcards f
      JOIN materials m ON f.material_id = m.id
      WHERE f.material_id = $1 AND f.user_id = $2 AND m.user_id = $2
      ORDER BY f.page_number, f.created_at
    `;

    const values = [materialId, userId];
    const result = await pool.query(query, values);

    res.status(200).json({
      message: "Flashcards retrieved successfully",
      flashcards: result.rows,
    });
  } catch (error) {
    console.error("Get flashcards error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/flashcards:
 *   get:
 *     summary: Get all flashcards for the authenticated user
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     responses:
 *       200:
 *         description: List of all user's flashcards
 *       500:
 *         description: Server error
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
      SELECT f.id, f.front_content, f.back_content, f.page_number, f.created_at, f.updated_at,
             m.id as material_id, m.file_name as material_name
      FROM flashcards f
      JOIN materials m ON f.material_id = m.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `;

    const values = [userId];
    const result = await pool.query(query, values);

    res.status(200).json({
      message: "All flashcards retrieved successfully",
      flashcards: result.rows,
    });
  } catch (error) {
    console.error("Get all flashcards error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/flashcards/{flashcardId}:
 *   get:
 *     summary: Get a specific flashcard by ID
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     parameters:
 *       - in: path
 *         name: flashcardId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The flashcard ID
 *     responses:
 *       200:
 *         description: Flashcard details
 *       404:
 *         description: Flashcard not found
 *       500:
 *         description: Server error
 */
router.get("/:flashcardId", verifyToken, async (req, res) => {
  try {
    const flashcardId = parseInt(req.params.flashcardId);
    const userId = req.user.userId;

    if (isNaN(flashcardId)) {
      return res.status(400).json({ message: "Invalid flashcard ID" });
    }

    const query = `
      SELECT f.id, f.front_content, f.back_content, f.page_number, f.created_at, f.updated_at,
             m.id as material_id, m.file_name as material_name
      FROM flashcards f
      JOIN materials m ON f.material_id = m.id
      WHERE f.id = $1 AND f.user_id = $2
    `;

    const values = [flashcardId, userId];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Flashcard not found or unauthorized" });
    }

    res.status(200).json({
      message: "Flashcard retrieved successfully",
      flashcard: result.rows[0],
    });
  } catch (error) {
    console.error("Get flashcard error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/flashcards/{flashcardId}:
 *   delete:
 *     summary: Delete a flashcard
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     parameters:
 *       - in: path
 *         name: flashcardId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The flashcard ID
 *     responses:
 *       200:
 *         description: Flashcard deleted successfully
 *       404:
 *         description: Flashcard not found
 *       500:
 *         description: Server error
 */
router.delete("/:flashcardId", verifyToken, async (req, res) => {
  try {
    const flashcardId = parseInt(req.params.flashcardId);
    const userId = req.user.userId;

    if (isNaN(flashcardId)) {
      return res.status(400).json({ message: "Invalid flashcard ID" });
    }

    const query = `
      DELETE FROM flashcards
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;

    const values = [flashcardId, userId];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Flashcard not found or unauthorized" });
    }

    res.status(200).json({
      message: "Flashcard deleted successfully",
      id: result.rows[0].id,
    });
  } catch (error) {
    console.error("Delete flashcard error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/flashcards/regenerate/{flashcardId}:
 *   post:
 *     summary: Regenerate AI content for an existing flashcard
 *     tags: [Flashcards]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     parameters:
 *       - in: path
 *         name: flashcardId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The flashcard ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contextText:
 *                 type: string
 *     responses:
 *       200:
 *         description: Flashcard content regenerated successfully
 *       404:
 *         description: Flashcard not found
 *       500:
 *         description: Server error
 */
router.post("/regenerate/:flashcardId", verifyToken, async (req, res) => {
  try {
    const flashcardId = parseInt(req.params.flashcardId);
    const { contextText } = req.body;
    const userId = req.user.userId;

    if (isNaN(flashcardId)) {
      return res.status(400).json({ message: "Invalid flashcard ID" });
    }

    // Get existing flashcard
    const getQuery = `
      SELECT f.id, f.front_content, f.material_id, m.file_name
      FROM flashcards f
      JOIN materials m ON f.material_id = m.id
      WHERE f.id = $1 AND f.user_id = $2
    `;

    const flashcard = await pool.query(getQuery, [flashcardId, userId]);

    if (flashcard.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Flashcard not found or unauthorized" });
    }

    // Generate new AI explanation using Gemini
    let backContent = "";
    try {
        const prompt = `You are an expert educator creating high-quality flashcards.  
        Generate a concise and informative explanation or definition for the given term, ensuring it is useful even if context is limited.  
        
        Study document: "${flashcard.rows[0].file_name}"  
        Selected term: "${
            flashcard.rows[0].front_content || "general concept related to the document"
        }"  
        
        ${
          contextText
            ? `Context: "${contextText}"`
            : "If context is missing, infer meaning based on general knowledge."
        }  
        
        Ensure the explanation is clear, precise, and educational, keeping it within 30 words.`;

      const result = await model.generateContent(prompt);
      backContent = result.response.text();
    } catch (error) {
      console.error("AI regeneration error:", error);
      return res
        .status(500)
        .json({
          message: "Failed to regenerate AI content",
          error: error.message,
        });
    }

    // Update flashcard
    const updateQuery = `
      UPDATE flashcards
      SET back_content = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
      RETURNING id, front_content, back_content, page_number, created_at, updated_at
    `;

    const values = [backContent, flashcardId, userId];
    const result = await pool.query(updateQuery, values);

    res.status(200).json({
      message: "Flashcard content regenerated successfully",
      flashcard: result.rows[0],
    });
  } catch (error) {
    console.error("Regenerate flashcard error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
