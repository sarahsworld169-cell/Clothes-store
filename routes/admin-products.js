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
      image_url,
      video_url,
      category,
      stock,
      sizes,
      colors
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Product name and price are required."
      });
    }

    const result = await pool.query(
      `INSERT INTO products
       (name, description, price, image_url, video_url,
        category, stock, sizes, colors)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        name,
        description || null,
        price,
        image_url || null,
        video_url || null,
        category || null,
        stock || 0,
        sizes || null,
        colors || null
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
      image_url,
      video_url,
      category,
      stock,
      sizes,
      colors
    } = req.body;

    const result = await pool.query(
      `UPDATE products
       SET name = $1,
           description = $2,
           price = $3,
           image_url = $4,
           video_url = $5,
           category = $6,
           stock = $7,
           sizes = $8,
           colors = $9
       WHERE id = $10
       RETURNING *`,
      [
        name,
        description || null,
        price,
        image_url || null,
        video_url || null,
        category || null,
        stock || 0,
        sizes || null,
        colors || null,
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
      "DELETE FROM products WHERE id = $1 RETURNING id",
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
      message: "Product deleted successfully."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not delete product."
    });
  }
});


module.exports = router;
