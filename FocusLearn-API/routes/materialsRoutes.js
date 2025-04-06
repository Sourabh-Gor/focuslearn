import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import { pool } from "../config/db.js";
import { bucket } from "../config/firebaseConfig.js";
import { verifyToken } from "../middleware/auth.js";
import { getStorage } from "firebase-admin/storage";
import { GoogleGenAI } from "@google/genai";
import textToSpeech from "@google-cloud/text-to-speech";
import "dotenv/config"; // Automatically loads your .env
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import concat from "concat-stream";

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get credentials path from env and resolve it
const credentialsPath = path.resolve(
  __dirname,
  "..",
  process.env.GOOGLE_TTS_CREDENTIALS
);

// Set GOOGLE_APPLICATION_CREDENTIALS so the SDK can find it
process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

// Now you can safely initialize the TTS client
const client = new TextToSpeechClient();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function makeFilesPublic() {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles();

  for (const file of files) {
    await file.makePublic();
    console.log(`Made public: ${file.name}`);
  }
}

makeFilesPublic();

dotenv.config();
const router = express.Router();

// Multer setup for file uploads (in-memory storage)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/materials/upload:
 *   post:
 *     summary: Upload a new study material (PDF/DOC)
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Material uploaded successfully
 *       400:
 *         description: Missing file
 *       500:
 *         description: Server error
 */
router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user.userId;

    if (!file) {
      return res.status(400).json({ message: "Missing file" });
    }

    // Store file under user's directory to match Firebase rules
    const fileName = `users/${userId}/${Date.now()}_${file.originalname}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      metadata: { contentType: file.mimetype },
    });

    blobStream.on("error", (err) => {
      console.error("Upload error:", err);
      res.status(500).json({ message: "Failed to upload file" });
    });

    blobStream.on("finish", async () => {
      await blob.makePublic();
      console.log(`Uploaded and made public: ${blob.name}`);
      const firebaseUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      const query = `
        INSERT INTO materials (user_id, file_name, firebase_url, file_size, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING id, user_id, file_name, firebase_url, upload_date, updated_at, file_size
      `;
      const values = [userId, file.originalname, firebaseUrl, file.size];

      try {
        const result = await pool.query(query, values);
        res.status(200).json({
          message: "Material uploaded successfully",
          material: result.rows[0],
        });
      } catch (err) {
        console.error("Database error:", err);
        res
          .status(500)
          .json({ message: "Failed to save metadata", error: err.message });
      }
    });

    blobStream.end(file.buffer);
  } catch (error) {
    console.error("Upload endpoint error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/materials/update/{materialId}:
 *   put:
 *     summary: Update an existing study material (PDF/DOC)
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     parameters:
 *       - in: path
 *         name: materialId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The material ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Material updated successfully
 *       400:
 *         description: Missing file or invalid material ID
 *       403:
 *         description: Unauthorized to update this material
 *       404:
 *         description: Material not found
 *       500:
 *         description: Server error
 */
router.put(
  "/update/:materialId",
  verifyToken,
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      const userId = req.user.userId;
      const materialId = parseInt(req.params.materialId);

      if (!file) {
        return res.status(400).json({ message: "Missing file" });
      }

      if (isNaN(materialId)) {
        return res.status(400).json({ message: "Invalid material ID" });
      }

      // Check if material exists and belongs to user
      const checkQuery = `
      SELECT firebase_url, file_name
      FROM materials
      WHERE id = $1 AND user_id = $2
    `;
      const checkResult = await pool.query(checkQuery, [materialId, userId]);

      if (checkResult.rows.length === 0) {
        return res
          .status(404)
          .json({ message: "Material not found or unauthorized" });
      }

      const existingFilePath = decodeURIComponent(
        checkResult.rows[0].firebase_url.split(`${bucket.name}/`)[1]
      );
      const blob = bucket.file(existingFilePath);

      const blobStream = blob.createWriteStream({
        metadata: { contentType: file.mimetype },
      });

      blobStream.on("error", (err) => {
        console.error("Update error:", err);
        res.status(500).json({ message: "Failed to update file" });
      });

      blobStream.on("finish", async () => {
        await blob.makePublic();
        console.log(`Updated and made public: ${blob.name}`);
        const updateQuery = `
        UPDATE materials 
        SET file_size = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND user_id = $3
        RETURNING id, user_id, file_name, firebase_url, upload_date, updated_at, file_size
      `;
        const updateValues = [file.size, materialId, userId];

        try {
          const result = await pool.query(updateQuery, updateValues);
          res.status(200).json({
            message: "Material updated successfully",
            material: result.rows[0],
          });
        } catch (err) {
          console.error("Database error:", err);
          res
            .status(500)
            .json({ message: "Failed to update metadata", error: err.message });
        }
      });

      blobStream.end(file.buffer);
    } catch (error) {
      console.error("Update endpoint error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/materials:
 *   get:
 *     summary: Get all materials for the authenticated user
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     responses:
 *       200:
 *         description: List of materials
 *       500:
 *         description: Server error
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
      SELECT id, user_id, file_name, firebase_url, upload_date, updated_at, file_size
      FROM materials
      WHERE user_id = $1
      ORDER BY updated_at DESC
    `;
    const values = [userId];

    const result = await pool.query(query, values);
    res.status(200).json({
      message: "Materials retrieved successfully",
      materials: result.rows,
    });
  } catch (error) {
    console.error("Get materials endpoint error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/materials/material/:materialId:
 *   get:
 *     summary: Get material using materialId for the authenticated user
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     responses:
 *       200:
 *         description: Material
 *       500:
 *         description: Server error
 */
router.get("/material/:materialId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
        SELECT id, user_id, file_name, firebase_url, upload_date, updated_at, file_size
        FROM materials
        WHERE user_id = $1 AND id = $2
      `;
    const values = [userId, req.params.materialId];

    const result = await pool.query(query, values);
    res.status(200).json({
      message: "Materials retrieved successfully",
      materials: result.rows,
    });
  } catch (error) {
    console.error("Get materials endpoint error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/materials/generate-summary/:materialId:
 *   get:
 *     summary: Get material using materialId for the authenticated user
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     responses:
 *       200:
 *         description: Material
 *       500:
 *         description: Server error
 */
router.post("/generate-summary/:materialId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
        SELECT id, user_id, file_name, firebase_url, upload_date, updated_at, file_size
        FROM materials
        WHERE user_id = $1 AND id = $2
      `;
    const values = [userId, req.params.materialId];
    const result = await pool.query(query, values);
    const pdfResp = await fetch(result.rows[0].firebase_url).then((response) =>
      response.arrayBuffer()
    );

    const contents = [
      { text: "Summarize this document" },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: Buffer.from(pdfResp).toString("base64"),
        },
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: contents,
    });

    res.json({ summary: response.text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

/**
 * @swagger
 * /api/materials/tts:
 *   get:
 *     summary: Get text to speech in base64 encoded for the text sent by the authenticated user
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     requestBody:
 *      required: true
 *     content:
 *       application/json:
 *        schema:
 *         type: object
 *        properties:
 *         text: { type: string }
 *        example: { text: "Hello, world!" }
 *     responses:
 *       200:
 *         description: Material
 *       500:
 *         description: Server error
 */
router.post("/tts", verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: "en-US", ssmlGender: "FEMALE" },
      audioConfig: { audioEncoding: "MP3" },
    });
    res.send(response.audioContent.toString("base64"));
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to generate audio" });
  }
});

// Utility: Convert one line to speech
async function synthesize(text, voiceName) {
  try {
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: "en-US",
        name: voiceName,
      },
      audioConfig: { audioEncoding: "MP3" },
    });

    return Buffer.from(response.audioContent);
  } catch (err) {
    console.error("Synthesis error:", err.message);
    return null;
  }
}


router.post("/generate-podcast/:materialId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const materialId = req.params.materialId;

    // Step 1: Fetch PDF URL
    const query = `
      SELECT id, firebase_url
      FROM materials
      WHERE user_id = $1 AND id = $2
    `;
    const values = [userId, materialId];
    const result = await pool.query(query, values);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Material not found" });
    }

    const pdfResp = await fetch(result.rows[0].firebase_url).then((r) =>
      r.arrayBuffer()
    );

    // Step 2: Ask Gemini to generate a 2-person podcast script
    const contents = [
      {
        text: "Turn this document into a podcast-style script with a natural, engaging dialogue between two hosts: Alex and Jamie. Clearly mark speaker names (e.g., 'Alex:' and 'Jamie:'). Keep it conversational and informative.Format it like:\nAlex: Hello...\nJamie: Thanks Alex... etc. Ensure only Alex or Jamie are used as speaker names.",
      },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: Buffer.from(pdfResp).toString("base64"),
        },
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents,
    });

    const script = response.text;
    console.log("Gemini Script:\n", script);

    // Step 3: Split the script by speakers
    const lines = script
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("Alex:") || line.includes("Jamie:"));

    const audioBuffers = [];
    console.log("Script lines parsed:", lines.length);
console.log("Sample line:", lines[0]);

    // Step 4: Synthesize audio per line with voice alternation
    for (const line of lines) {
      if (line.startsWith("Alex:")) {
        const spoken = line.replace("Alex:", "").trim();
        const buffer = await synthesize(spoken, "en-US-Wavenet-D"); // Male
        console.log(
          "Line:",
          spoken.slice(0, 30),
          "... Buffer length:",
          buffer.length
        );
        audioBuffers.push(buffer);
      } else if (line.startsWith("Jamie:")) {
        const spoken = line.replace("Jamie:", "").trim();
        const buffer = await synthesize(spoken, "en-US-Wavenet-F"); // Female
        console.log(
          "Line:",
          spoken.slice(0, 30),
          "... Buffer length:",
          buffer.length
        );

        if (buffer) audioBuffers.push(buffer);
else console.warn("Skipped line due to synthesis failure:", line);

      }
    }
    console.log("Buffers generated:", audioBuffers.length);
    audioBuffers.forEach((buf, i) => {
      console.log(`Buffer ${i} size: ${buf.length}`);
    });

    // Step 5: Concatenate and return final audio
    const finalAudio = Buffer.concat(audioBuffers);
    console.log("Podcast audio generated successfully");
    console.log("Podcast audio size:", finalAudio.length / 1024, "KB");
    console.log("Podcast audio type:", typeof finalAudio);
    console.log(
      "Podcast audio encoding:",
      finalAudio.toString("base64").slice(0, 50) + "..."
    );
    res.send(finalAudio.toString("base64"));
  } catch (error) {
    console.error("Podcast Generation Error:", error);
    res.status(500).json({ error: "Failed to generate podcast" });
  }
});

export default router;
