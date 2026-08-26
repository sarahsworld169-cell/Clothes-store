const express = require("express");
const { Pool } = require("pg");

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});


/* =========================
   GET PRODUCTS
   Search + Category + Sort
========================= */

router.get("/", async (req, res) => {
  try {
    const {
      search,
      category,
      sort
    } = req.query;

    let query = `
      SELECT
        p.*,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c
        ON p.category_id = c.id
      WHERE p.is_active = TRUE
    `;

    const values = [];

    if (search) {
      values.push(`%${search.trim()}%`);

      query += `
        AND (
          p.name ILIKE $${values.length}
          OR p.description ILIKE $${values.length}
        )
      `;
    }

    if (category) {
      values.push(category);

      query += `
        AND (
          c.id::TEXT = $${values.length}
          OR LOWER(c.name) = LOWER($${values.length})
        )
      `;
    }

    if (sort === "price_low") {
      query += " ORDER BY COALESCE(p.discount_price, p.price) ASC";
    } else if (sort === "price_high") {
      query += " ORDER BY COALESCE(p.discount_price, p.price) DESC";
    } else if (sort === "oldest") {
      query += " ORDER BY p.created_at ASC";
    } else {
      query += " ORDER BY p.created_at DESC";
    }

    const result = await pool.query(query, values);

    res.json({
      success: true,
      products: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load products."
    });
  }
});


/* =========================
   GET CATEGORIES
========================= */

router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM categories
       WHERE is_active = TRUE
       ORDER BY name ASC`
    );

    res.json({
      success: true,
      categories: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load categories."
    });
  }
});


/* =========================
   GET FEATURED PRODUCTS
========================= */

router.get("/featured", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.*,
         c.name AS category_name
       FROM products p
       LEFT JOIN categories c
         ON p.category_id = c.id
       WHERE p.is_active = TRUE
         AND p.is_featured = TRUE
       ORDER BY p.created_at DESC`
    );

    res.json({
      success: true,
      products: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load featured products."
    });
  }
});


/* =========================
   GET SINGLE PRODUCT
   FULL DETAILS
========================= */

router.get("/:id", async (req, res) => {
  try {

    const productResult = await pool.query(
      `SELECT
         p.*,
         c.name AS category_name
       FROM products p
       LEFT JOIN categories c
         ON p.category_id = c.id
       WHERE p.id = $1
         AND p.is_active = TRUE`,
      [req.params.id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    const product = productResult.rows[0];

    const imagesResult = await pool.query(
      `SELECT id, image_url, sort_order
       FROM product_images
       WHERE product_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [req.params.id]
    );

    const reviewsResult = await pool.query(
      `SELECT
         r.id,
         r.rating,
         r.review_text,
         r.created_at,
         u.name AS user_name
       FROM reviews r
       JOIN users u
         ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );

    const ratingResult = await pool.query(
      `SELECT
         COUNT(*)::INTEGER AS review_count,
         COALESCE(AVG(rating), 0)::NUMERIC(3,2) AS average_rating
       FROM reviews
       WHERE product_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,

      product: {
        ...product,

        images: imagesResult.rows,

        reviews: reviewsResult.rows,

        rating: {
          average: Number(ratingResult.rows[0].average_rating),
          count: ratingResult.rows[0].review_count
        }
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load product details."
    });
  }
});


module.exports = router;
