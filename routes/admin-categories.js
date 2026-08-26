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
   ADD REVIEW
========================= */

router.post("/:productId", authenticate, async (req, res) => {
  try {
    const { rating, review_text } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5."
      });
    }

    const product = await pool.query(
      `SELECT id
       FROM products
       WHERE id = $1
         AND is_active = TRUE`,
      [req.params.productId]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    const existingReview = await pool.query(
      `SELECT id
       FROM reviews
       WHERE product_id = $1
         AND user_id = $2`,
      [
        req.params.productId,
        req.user.id
      ]
    );

    if (existingReview.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "You already reviewed this product."
      });
    }

    const result = await pool.query(
      `INSERT INTO reviews
       (product_id, user_id, rating, review_text)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        req.params.productId,
        req.user.id,
        rating,
        review_text || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Review added successfully.",
      review: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not add review."
    });
  }
});


/* =========================
   DELETE MY REVIEW
========================= */

router.delete("/:reviewId", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM reviews
       WHERE id = $1
         AND user_id = $2
       RETURNING id`,
      [
        req.params.reviewId,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Review not found."
      });
    }

    res.json({
      success: true,
      message: "Review deleted successfully."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not delete review."
    });
  }
});


module.exports = router;
