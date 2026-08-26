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
   ADD PRODUCT
========================= */

router.post("/", adminOnly, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      discount_price,
      image_url,
      video_url,
      category_id,
      stock,
      sizes,
      colors,
      is_featured
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Product name and price are required."
      });
    }

    const result = await pool.query(
      `INSERT INTO products
       (
         name,
         description,
         price,
         discount_price,
         image_url,
         video_url,
         category_id,
         stock,
         sizes,
         colors,
         is_featured
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        name.trim(),
        description || null,
        price,
        discount_price || null,
        image_url || null,
        video_url || null,
        category_id || null,
        stock || 0,
        sizes || null,
        colors || null,
        is_featured || false
      ]
    );

    res.status(201).json({
      success: true,
      message: "Product added successfully.",
      product: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not add product."
    });
  }
});


/* =========================
   UPDATE PRODUCT
========================= */

router.put("/:id", adminOnly, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      discount_price,
      image_url,
      video_url,
      category_id,
      stock,
      sizes,
      colors,
      is_featured,
      is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE products
       SET
         name = $1,
         description = $2,
         price = $3,
         discount_price = $4,
         image_url = $5,
         video_url = $6,
         category_id = $7,
         stock = $8,
         sizes = $9,
         colors = $10,
         is_featured = $11,
         is_active = $12,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING *`,
      [
        name,
        description || null,
        price,
        discount_price || null,
        image_url || null,
        video_url || null,
        category_id || null,
        stock || 0,
        sizes || null,
        colors || null,
        is_featured || false,
        is_active !== false,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    res.json({
      success: true,
      message: "Product updated successfully.",
      product: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not update product."
    });
  }
});


/* =========================
   DELETE PRODUCT
========================= */

router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE products
       SET is_active = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    res.json({
      success: true,
      message: "Product removed successfully."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not remove product."
    });
  }
});


/* =========================
   ADD PRODUCT IMAGE
========================= */

router.post("/:id/images", adminOnly, async (req, res) => {
  try {
    const { image_url, sort_order } = req.body;

    if (!image_url) {
      return res.status(400).json({
        success: false,
        message: "Image URL is required."
      });
    }

    const product = await pool.query(
      "SELECT id FROM products WHERE id = $1",
      [req.params.id]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    const result = await pool.query(
      `INSERT INTO product_images
       (product_id, image_url, sort_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        req.params.id,
        image_url,
        sort_order || 0
      ]
    );

    res.status(201).json({
      success: true,
      message: "Product image added.",
      image: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not add product image."
    });
  }
});


/* =========================
   DELETE PRODUCT IMAGE
========================= */

router.delete("/:id/images/:imageId", adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM product_images
       WHERE id = $1 AND product_id = $2
       RETURNING id`,
      [
        req.params.imageId,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product image not found."
      });
    }

    res.json({
      success: true,
      message: "Product image deleted."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not delete product image."
    });
  }
});


/* =========================
   GET ADMIN PRODUCTS
========================= */

router.get("/", adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.*,
         c.name AS category_name
       FROM products p
       LEFT JOIN categories c
         ON p.category_id = c.id
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
      message: "Could not load products."
    });
  }
});


module.exports = router;
