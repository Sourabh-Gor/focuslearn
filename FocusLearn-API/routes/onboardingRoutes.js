// onboardingRoutes.js
import express from "express";
import { pool } from "../config/db.js";
import dotenv from "dotenv";
import { verifyToken } from "../middleware/auth.js";

dotenv.config();
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Onboarding
 *   description: User onboarding endpoints
 */

/**
 * @swagger
 * /api/onboarding/complete:
 *   post:
 *     summary: Complete user onboarding
 *     tags: [Onboarding]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - initialAttentionSpan
 *               - preferredStudyTime
 *             properties:
 *               initialAttentionSpan:
 *                 type: integer
 *                 description: User's initial attention span in minutes
 *               preferredStudyTime:
 *                 type: string
 *                 enum: [short, balanced, long]
 *                 description: User's preferred study session style
 *               commonDistractions:
 *                 type: string
 *                 description: Common distractions (optional)
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/complete', verifyToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { initialAttentionSpan, preferredStudyTime, commonDistractions, avg_study_time } = req.body;

        // Validate input
        if (!initialAttentionSpan || !['short', 'balanced', 'long'].includes(preferredStudyTime)) {
            return res.status(400).json({ message: 'Invalid attention span or study preference' });
        }

        await client.query('BEGIN');

        // Insert into user_preferences
        const preferenceResult = await client.query(
            `INSERT INTO user_preferences (user_id, avg_study_duration, initial_attention_span, preferred_study_time, common_distractions, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING id, user_id, initial_attention_span, preferred_study_time, common_distractions`,
            [req.user.userId, avg_study_time, initialAttentionSpan, preferredStudyTime, commonDistractions || null]
        );

        // Update users table
        const userResult = await client.query(
            `UPDATE users 
             SET onboarding_completed = TRUE 
             WHERE id = $1 
             RETURNING id, email, name, onboarding_completed`,
            [req.user.userId]
        );

        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }

        await client.query('COMMIT');

        res.json({
            message: 'Onboarding completed',
            user: userResult.rows[0],
            preferences: preferenceResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        client.release();
    }
});

export default router;