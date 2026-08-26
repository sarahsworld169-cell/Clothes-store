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
   GET PRODUCT REVIEWS
========================= */

router.get("/product/:productId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r.product_id,
         r.user_id,
         r.rating,
         r.comment,
         r.created_at,
         u.name AS user_name
       FROM reviews r
       LEFT JOIN users u
         ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.productId]
    );

    res.json({
      success: true,
      reviews: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load reviews."
    });
  }
});


/* =========================
   ADD REVIEW
========================= */

router.post("/", authenticate, async (req, res) => {
  try {
    const {
      product_id,
      rating,
      comment
    } = req.body;

    if (!product_id || !rating) {
      return res.status(400).json({
        success: false,
        message: "Product and rating are required."
      });
    }

    const numericRating = Number(rating);

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5."
      });
    }


    /* =========================
       CHECK PRODUCT
    ========================= */

    const productResult = await pool.query(
      `SELECT id
       FROM products
       WHERE id = $1
         AND is_active = TRUE`,
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }


    /* =========================
       CHECK PREVIOUS REVIEW
    ========================= */

    const existingReview = await pool.query(
      `SELECT id
       FROM reviews
       WHERE product_id = $1
         AND user_id = $2`,
      [
        product_id,
        req.user.id
      ]
    );

    if (existingReview.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product."
      });
    }


    /* =========================
       CREATE REVIEW
    ========================= */

    const result = await pool.query(
      `INSERT INTO reviews
       (
         product_id,
         user_id,
         rating,
         comment
       )
       VALUES
       ($1,$2,$3,$4)
       RETURNING *`,
      [
        product_id,
        req.user.id,
        numericRating,
        comment || null
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
   UPDATE MY REVIEW
========================= */

router.patch("/:id", authenticate, async (req, res) => {
  try {
    const {
      rating,
      comment
    } = req.body;

    const numericRating = Number(rating);

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5."
      });
    }

    const result = await pool.query(
      `UPDATE reviews
       SET
         rating = $1,
         comment = $2
       WHERE id = $3
         AND user_id = $4
       RETURNING *`,
      [
        numericRating,
        comment || null,
        req.params.id,
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
      message: "Review updated successfully.",
      review: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not update review."
    });
  }
});


/* =========================
   DELETE MY REVIEW
========================= */

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM reviews
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
