import express from "express";
import { pool } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Study Sessions
 *   description: Managing study sessions, attention tracking, and analytics
 */

/**
 * @swagger
 * /api/sessions/start:
 *   post:
 *     summary: Start a new study session
 *     tags: [Study Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plannedSessionId:
 *                 type: integer
 *                 description: ID of the planned session (optional)
 *     responses:
 *       201:
 *         description: Session started successfully
 *       500:
 *         description: Server error
 */
router.post("/start", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { plannedSessionId } = req.body;

    // Create a new study session
    const newSession = await pool.query(
      `INSERT INTO study_sessions 
       (planned_session_id, user_id, started_at, status, attention_score, distractions_count) 
       VALUES ($1, $2, NOW(), 'IN_PROGRESS', 100, 0) 
       RETURNING *`,
      [plannedSessionId || null, userId]
    );

    // If this is a planned session, update its status
    if (plannedSessionId) {
      await pool.query(
        "UPDATE planned_sessions SET status = 'IN_PROGRESS' WHERE id = $1",
        [plannedSessionId]
      );
    }

    res.status(201).json({
      message: "Study session started",
      session: newSession.rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}/pause:
 *   put:
 *     summary: Pause an ongoing study session
 *     tags: [Study Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Session paused successfully
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.put("/:sessionId/pause", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;

    // Check if session exists and belongs to user
    const sessionCheck = await pool.query(
      "SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2",
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Update session status
    const updatedSession = await pool.query(
      "UPDATE study_sessions SET status = 'PAUSED' WHERE id = $1 RETURNING *",
      [sessionId]
    );

    // Record pause activity
    await pool.query(
      `INSERT INTO session_activities 
       (session_id, activity_type, start_time, end_time, duration, details) 
       VALUES ($1, 'PAUSE', NOW(), NULL, NULL, '{"reason": "user_initiated"}')`,
      [sessionId]
    );

    res.json({
      message: "Study session paused",
      session: updatedSession.rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}/resume:
 *   put:
 *     summary: Resume a paused study session
 *     tags: [Study Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Session resumed successfully
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.put("/:sessionId/resume", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;

    // Check if session exists and belongs to user
    const sessionCheck = await pool.query(
      "SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2",
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Update session status
    const updatedSession = await pool.query(
      "UPDATE study_sessions SET status = 'IN_PROGRESS' WHERE id = $1 RETURNING *",
      [sessionId]
    );

    // Update the most recent pause activity to include end time and duration
    await pool.query(
      `UPDATE session_activities 
       SET end_time = NOW(), 
           duration = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER
       WHERE session_id = $1 
       AND activity_type = 'PAUSE' 
       AND end_time IS NULL`,
      [sessionId]
    );

    res.json({
      message: "Study session resumed",
      session: updatedSession.rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}/complete:
 *   put:
 *     summary: Complete a study session
 *     tags: [Study Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Session completed successfully
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.put("/:sessionId/complete", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;

    // Check if session exists and belongs to user
    const sessionCheck = await pool.query(
      "SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2",
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Calculate session duration
    const sessionData = await pool.query(
      `SELECT 
        EXTRACT(EPOCH FROM (NOW() - started_at)) as total_seconds,
        planned_session_id
       FROM study_sessions 
       WHERE id = $1`,
      [sessionId]
    );
    
    const totalSeconds = sessionData.rows[0].total_seconds;
    const plannedSessionId = sessionData.rows[0].planned_session_id;
    
    // Calculate actual duration (total time minus pauses)
    const pauseData = await pool.query(
      `SELECT COALESCE(SUM(duration), 0) as total_pause_seconds
       FROM session_activities
       WHERE session_id = $1 AND activity_type = 'PAUSE'`,
      [sessionId]
    );
    
    const totalPauseSeconds = pauseData.rows[0].total_pause_seconds;
    const actualDuration = Math.floor((totalSeconds - totalPauseSeconds) / 60); // Convert to minutes

    // Update session status and completion data
    const updatedSession = await pool.query(
      `UPDATE study_sessions 
       SET status = 'COMPLETED', 
           completed_at = NOW(), 
           actual_duration = $1
       WHERE id = $2 RETURNING *`,
      [actualDuration, sessionId]
    );

    // If this was a planned session, update its status
    if (plannedSessionId) {
      await pool.query(
        `UPDATE planned_sessions 
         SET status = 'COMPLETED', 
             completed_at = NOW() 
         WHERE id = $1`,
        [plannedSessionId]
      );
    }

    res.json({
      message: "Study session completed",
      session: updatedSession.rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}/distraction:
 *   post:
 *     summary: Record a distraction during a study session
 *     tags: [Study Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               distractionType:
 *                 type: string
 *                 description: Type of distraction (e.g., LOOKING_AWAY, USER_ABSENT, PHONE_USAGE)
 *               details:
 *                 type: object
 *                 description: Additional details about the distraction
 *     responses:
 *       201:
 *         description: Distraction recorded successfully
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.post("/:sessionId/distraction", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;
    const { distractionType, details } = req.body;

    // Check if session exists and belongs to user
    const sessionCheck = await pool.query(
      "SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2",
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Record distraction activity
    const newActivity = await pool.query(
      `INSERT INTO session_activities 
       (session_id, activity_type, start_time, end_time, duration, details) 
       VALUES ($1, 'DISTRACTION', NOW(), NOW(), 0, $2) 
       RETURNING *`,
      [sessionId, JSON.stringify({ type: distractionType, ...details })]
    );

    // Update distraction count and reduce attention score
    await pool.query(
      `UPDATE study_sessions 
       SET distractions_count = distractions_count + 1,
           attention_score = GREATEST(attention_score - 5, 0)
       WHERE id = $1 
       RETURNING attention_score, distractions_count`,
      [sessionId]
    );

    res.status(201).json({
      message: "Distraction recorded",
      activity: newActivity.rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/sessions/user:
 *   get:
 *     summary: Get all study sessions for the current user
 *     tags: [Study Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all user sessions
 *       500:
 *         description: Server error
 */
router.get("/user", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const sessions = await pool.query(
      `SELECT ss.*, 
        sm.title as material_title,
        cs.title as segment_title
       FROM study_sessions ss
       LEFT JOIN planned_sessions ps ON ss.planned_session_id = ps.id
       LEFT JOIN content_segments cs ON ps.segment_id = cs.id
       LEFT JOIN study_plans sp ON ps.plan_id = sp.id
       LEFT JOIN study_materials sm ON sp.material_id = sm.id
       WHERE ss.user_id = $1
       ORDER BY ss.started_at DESC`,
      [userId]
    );

    res.json(sessions.rows);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     summary: Get details for a specific study session
 *     tags: [Study Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Session details
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.get("/:sessionId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;

    // Get session with related data
    const sessionResult = await pool.query(
      `SELECT ss.*,
        sm.title as material_title,
        cs.title as segment_title
       FROM study_sessions ss
       LEFT JOIN planned_sessions ps ON ss.planned_session_id = ps.id
       LEFT JOIN content_segments cs ON ps.segment_id = cs.id
       LEFT JOIN study_plans sp ON ps.plan_id = sp.id
       LEFT JOIN study_materials sm ON sp.material_id = sm.id
       WHERE ss.id = $1 AND ss.user_id = $2`,
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Get activities for this session
    const activitiesResult = await pool.query(
      `SELECT * FROM session_activities
       WHERE session_id = $1
       ORDER BY start_time ASC`,
      [sessionId]
    );

    res.json({
      ...sessionResult.rows[0],
      activities: activitiesResult.rows,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * @swagger
 * /api/sessions/analytics:
 *   get:
 *     summary: Get study analytics for the current user
 *     tags: [Study Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User study analytics
 *       500:
 *         description: Server error
 */
router.get("/analytics", verifyToken, async (req, res) => {
    try {
      const userId = req.user.userId;
  
      // Get total study time
      const totalTimeResult = await pool.query(
        `SELECT COALESCE(SUM(actual_duration), 0) as total_study_minutes
         FROM study_sessions
         WHERE user_id = $1 AND status = 'COMPLETED'`,
        [userId]
      );
      
      // Get average attention score
      const attentionResult = await pool.query(
        `SELECT COALESCE(AVG(attention_score), 0) as avg_attention_score
         FROM study_sessions
         WHERE user_id = $1 AND status = 'COMPLETED'`,
        [userId]
      );
      
      // Get total completed sessions
      const sessionsResult = await pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_sessions,
          COUNT(*) as total_sessions
         FROM study_sessions
         WHERE user_id = $1`,
        [userId]
      );
      
      // Get most common distraction types
      const distractionsResult = await pool.query(
        `SELECT 
          details->>'type' as distraction_type,
          COUNT(*) as count
         FROM session_activities
         WHERE session_id IN (SELECT id FROM study_sessions WHERE user_id = $1)
         AND activity_type = 'DISTRACTION'
         GROUP BY details->>'type'
         ORDER BY count DESC
         LIMIT 5`,
        [userId]
      );
      
      // Get study patterns by time of day
      const timePatternResult = await pool.query(
        `SELECT 
          CASE
            WHEN EXTRACT(HOUR FROM started_at) BETWEEN 5 AND 11 THEN 'morning'
            WHEN EXTRACT(HOUR FROM started_at) BETWEEN 12 AND 16 THEN 'afternoon'
            WHEN EXTRACT(HOUR FROM started_at) BETWEEN 17 AND 20 THEN 'evening'
            ELSE 'night'
          END as time_of_day,
          COUNT(*) as session_count,
          COALESCE(AVG(attention_score), 0) as avg_attention_score
         FROM study_sessions
         WHERE user_id = $1
         GROUP BY time_of_day
         ORDER BY session_count DESC`,
        [userId]
      );
  
      // Get recent activity (last 7 days)
      const recentActivityResult = await pool.query(
        `SELECT 
          DATE(started_at) as study_date,
          COUNT(*) as sessions_count,
          COALESCE(SUM(actual_duration), 0) as total_minutes,
          COALESCE(AVG(attention_score), 0) as avg_attention
         FROM study_sessions
         WHERE user_id = $1
         AND started_at >= NOW() - INTERVAL '7 days'
         GROUP BY study_date
         ORDER BY study_date ASC`,
        [userId]
      );
  
      res.json({
        totalStudyMinutes: totalTimeResult.rows[0].total_study_minutes,
        avgAttentionScore: attentionResult.rows[0].avg_attention_score,
        completedSessions: sessionsResult.rows[0].completed_sessions,
        totalSessions: sessionsResult.rows[0].total_sessions,
        completionRate: sessionsResult.rows[0].total_sessions > 0 
          ? (sessionsResult.rows[0].completed_sessions / sessionsResult.rows[0].total_sessions) * 100 
          : 0,
        commonDistractions: distractionsResult.rows,
        timePatterns: timePatternResult.rows,
        recentActivity: recentActivityResult.rows
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
  
  /**
   * @swagger
   * /api/sessions/attention-data:
   *   post:
   *     summary: Submit attention tracking data from Google Vision API
   *     tags: [Study Sessions]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               sessionId:
   *                 type: integer
   *               attentionScore:
   *                 type: number
   *               faceData:
   *                 type: object
   *                 description: Face detection data from Google Vision API
   *               isDistracted:
   *                 type: boolean
   *               distractionType:
   *                 type: string
   *     responses:
   *       200:
   *         description: Attention data processed
   *       404:
   *         description: Session not found
   *       500:
   *         description: Server error
   */
  router.post("/attention-data", verifyToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const { sessionId, attentionScore, faceData, isDistracted, distractionType } = req.body;
  
      // Check if session exists and belongs to user
      const sessionCheck = await pool.query(
        "SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2",
        [sessionId, userId]
      );
  
      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ message: "Session not found" });
      }
  
      // Update session attention score (using weighted average)
      const currentScore = sessionCheck.rows[0].attention_score;
      const newScore = (currentScore * 0.9) + (attentionScore * 0.1); // 90% old score, 10% new data
  
      await pool.query(
        "UPDATE study_sessions SET attention_score = $1 WHERE id = $2",
        [newScore, sessionId]
      );
  
      // If distracted, record the distraction
      if (isDistracted && distractionType) {
        await pool.query(
          `INSERT INTO session_activities 
           (session_id, activity_type, start_time, end_time, duration, details) 
           VALUES ($1, 'DISTRACTION', NOW(), NOW(), 0, $2)`,
          [sessionId, JSON.stringify({ 
            type: distractionType, 
            faceData: faceData || {},
            attentionScore
          })]
        );
  
        // Update distraction count
        await pool.query(
          "UPDATE study_sessions SET distractions_count = distractions_count + 1 WHERE id = $1",
          [sessionId]
        );
      }
  
      res.json({ 
        message: "Attention data processed",
        newAttentionScore: newScore
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
  
  /**
   * @swagger
   * /api/sessions/materials/{materialId}:
   *   get:
   *     summary: Get sessions for a specific study material
   *     tags: [Study Sessions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: materialId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Sessions for the specified material
   *       500:
   *         description: Server error
   */
  router.get("/materials/:materialId", verifyToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const { materialId } = req.params;
  
      const sessions = await pool.query(
        `SELECT ss.* 
         FROM study_sessions ss
         JOIN planned_sessions ps ON ss.planned_session_id = ps.id
         JOIN study_plans sp ON ps.plan_id = sp.id
         WHERE sp.material_id = $1 AND ss.user_id = $2
         ORDER BY ss.started_at DESC`,
        [materialId, userId]
      );
  
      res.json(sessions.rows);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
  
  /**
   * @swagger
   * /api/sessions/abandon/{sessionId}:
   *   put:
   *     summary: Abandon a study session
   *     tags: [Study Sessions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reason:
   *                 type: string
   *                 description: Reason for abandoning the session
   *     responses:
   *       200:
   *         description: Session abandoned successfully
   *       404:
   *         description: Session not found
   *       500:
   *         description: Server error
   */
  router.put("/abandon/:sessionId", verifyToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const { sessionId } = req.params;
      const { reason } = req.body;
  
      // Check if session exists and belongs to user
      const sessionCheck = await pool.query(
        "SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2",
        [sessionId, userId]
      );
  
      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ message: "Session not found" });
      }
  
      // Update session status
      const updatedSession = await pool.query(
        `UPDATE study_sessions 
         SET status = 'ABANDONED', 
             completed_at = NOW()
         WHERE id = $1 RETURNING *`,
        [sessionId]
      );
  
      // Record abandonment reason
      await pool.query(
        `INSERT INTO session_activities 
         (session_id, activity_type, start_time, end_time, duration, details) 
         VALUES ($1, 'ABANDONMENT', NOW(), NOW(), 0, $2)`,
        [sessionId, JSON.stringify({ reason: reason || "Not specified" })]
      );
  
      res.json({
        message: "Session abandoned",
        session: updatedSession.rows[0],
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
  
  /**
   * @swagger
   * /api/sessions/user/last-session:
   *   get:
   *     summary: Get the user's most recent study session
   *     tags: [Study Sessions]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Most recent session or null if none exists
   *       500:
   *         description: Server error
   */
  router.get("/user/last-session", verifyToken, async (req, res) => {
    try {
      const userId = req.user.userId;
  
      const lastSession = await pool.query(
        `SELECT ss.*,
          sm.title as material_title,
          cs.title as segment_title
         FROM study_sessions ss
         LEFT JOIN planned_sessions ps ON ss.planned_session_id = ps.id
         LEFT JOIN content_segments cs ON ps.segment_id = cs.id
         LEFT JOIN study_plans sp ON ps.plan_id = sp.id
         LEFT JOIN study_materials sm ON sp.material_id = sm.id
         WHERE ss.user_id = $1
         ORDER BY ss.started_at DESC
         LIMIT 1`,
        [userId]
      );
  
      res.json(lastSession.rows[0] || null);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
  
  export default router;