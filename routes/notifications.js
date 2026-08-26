const express = require("express");
const { Pool } = require("pg");
const authenticate = require("../middleware/auth");

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});


/* =========================
   GET MY NOTIFICATIONS
========================= */

router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         order_id,
         title,
         message,
         type,
         is_read,
         created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      notifications: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load notifications."
    });
  }
});


/* =========================
   UNREAD COUNT
========================= */

router.get("/unread-count", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::INTEGER AS unread_count
       FROM notifications
       WHERE user_id = $1
         AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({
      success: true,
      unread_count: result.rows[0].unread_count
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not get unread count."
    });
  }
});


/* =========================
   MARK ONE AS READ
========================= */

router.patch("/:id/read", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
      [
        req.params.id,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found."
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read.",
      notification: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not update notification."
    });
  }
});


/* =========================
   MARK ALL AS READ
========================= */

router.patch("/read-all", authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1
         AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: "All notifications marked as read."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not update notifications."
    });
  }
});


/* =========================
   DELETE ONE NOTIFICATION
========================= */

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE id = $1
         AND user_id = $2
       RETURNING id`,
      [
        req.params.id,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found."
      });
    }

    res.json({
      success: true,
      message: "Notification deleted."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not delete notification."
    });
  }
});


/* =========================
   DELETE ALL NOTIFICATIONS
========================= */

router.delete("/", authenticate, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM notifications
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: "All notifications deleted."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not delete notifications."
    });
  }
});


module.exports = router;
