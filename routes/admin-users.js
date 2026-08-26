const express = require("express");
const { Pool } = require("pg");
const adminOnly = require("../middleware/admin");

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});


/* =========================
   GET ALL USERS
========================= */

router.get("/", adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         name,
         email,
         phone,
         role,
         status,
         ban_reason,
         banned_at,
         created_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      users: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load users."
    });
  }
});


/* =========================
   GET SINGLE USER
   PROFILE + ORDER COUNT
========================= */

router.get("/:id", adminOnly, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT
         id,
         name,
         email,
         phone,
         role,
         status,
         ban_reason,
         banned_at,
         created_at
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const user = userResult.rows[0];

    const orderResult = await pool.query(
      `SELECT
         COUNT(*)::INTEGER AS total_orders,
         COUNT(*) FILTER (
           WHERE order_status = 'delivered'
         )::INTEGER AS delivered_orders,
         COUNT(*) FILTER (
           WHERE order_status = 'cancelled'
         )::INTEGER AS cancelled_orders
       FROM orders
       WHERE user_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      user: {
        ...user,
        order_stats: orderResult.rows[0]
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load user profile."
    });
  }
});


/* =========================
   GET USER ORDERS
========================= */

router.get("/:id/orders", adminOnly, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const ordersResult = await pool.query(
      `SELECT
         o.*,
         da.area_name
       FROM orders o
       LEFT JOIN delivery_areas da
         ON o.delivery_area_id = da.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.params.id]
    );

    res.json({
      success: true,
      orders: ordersResult.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load user orders."
    });
  }
});


/* =========================
   BAN USER
========================= */

router.post("/:id/ban", adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;

    const userResult = await pool.query(
      `SELECT id, role, status
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const user = userResult.rows[0];


    /* =========================
       PROTECT ADMINS
    ========================= */

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin users cannot be banned."
      });
    }


    if (user.status === "banned") {
      return res.status(400).json({
        success: false,
        message: "User is already banned."
      });
    }


    const banReason =
      typeof reason === "string" && reason.trim()
        ? reason.trim()
        : "Your account has been banned by the administrator.";


    const result = await pool.query(
      `UPDATE users
       SET
         status = 'banned',
         ban_reason = $1,
         banned_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING
         id,
         name,
         email,
         status,
         ban_reason,
         banned_at`,
      [
        banReason,
        req.params.id
      ]
    );


    /* =========================
       USER NOTIFICATION
    ========================= */

    await pool.query(
      `INSERT INTO notifications
       (
         user_id,
         title,
         message,
         type
       )
       VALUES
       ($1,$2,$3,'account_banned')`,
      [
        req.params.id,
        "🚫 Account Banned",
        `Your account has been banned. Reason: ${banReason}`
      ]
    );


    res.json({
      success: true,
      message: "User banned successfully.",
      user: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not ban user."
    });
  }
});


/* =========================
   UNBAN USER
========================= */

router.post("/:id/unban", adminOnly, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, role, status
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const user = userResult.rows[0];

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "This user is an admin."
      });
    }

    if (user.status !== "banned") {
      return res.status(400).json({
        success: false,
        message: "User is not banned."
      });
    }


    const result = await pool.query(
      `UPDATE users
       SET
         status = 'active',
         ban_reason = NULL,
         banned_at = NULL
       WHERE id = $1
       RETURNING
         id,
         name,
         email,
         status`,
      [req.params.id]
    );


    /* =========================
       USER NOTIFICATION
    ========================= */

    await pool.query(
      `INSERT INTO notifications
       (
         user_id,
         title,
         message,
         type
       )
       VALUES
       ($1,$2,$3,'account_unbanned')`,
      [
        req.params.id,
        "✅ Account Unbanned",
        "Your account has been unbanned. You can use the store again."
      ]
    );


    res.json({
      success: true,
      message: "User unbanned successfully.",
      user: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not unban user."
    });
  }
});


/* =========================
   DELETE USER
========================= */

router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, role
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (userResult.rows[0].role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin users cannot be deleted."
      });
    }


    /*
      Keep order history.
      Only remove the user if the database
      allows it without breaking order records.
    */

    const result = await pool.query(
      `DELETE FROM users
       WHERE id = $1
       RETURNING id, name, email`,
      [req.params.id]
    );

    res.json({
      success: true,
      message: "User deleted successfully.",
      user: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    /*
      If the user has orders, PostgreSQL may
      prevent deletion because orders reference
      that user.
    */

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "This user has order history and cannot be deleted."
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not delete user."
    });
  }
});


module.exports = router;
