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


/* ========================================
   CATEGORIES
======================================== */


/* GET ALL CATEGORIES */

router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM categories
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


/* ADD CATEGORY */

router.post("/categories", adminOnly, async (req, res) => {
  try {
    const {
      name,
      description,
      image_url
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required."
      });
    }

    const result = await pool.query(
      `INSERT INTO categories
       (name, description, image_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        name.trim(),
        description || null,
        image_url || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Category created successfully.",
      category: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This category already exists."
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not create category."
    });
  }
});


/* UPDATE CATEGORY */

router.put("/categories/:id", adminOnly, async (req, res) => {
  try {
    const {
      name,
      description,
      image_url,
      is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE categories
       SET
         name = $1,
         description = $2,
         image_url = $3,
         is_active = $4
       WHERE id = $5
       RETURNING *`,
      [
        name,
        description || null,
        image_url || null,
        is_active !== false,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found."
      });
    }

    res.json({
      success: true,
      message: "Category updated successfully.",
      category: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not update category."
    });
  }
});


/* DELETE CATEGORY */

router.delete("/categories/:id", adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE categories
       SET is_active = FALSE
       WHERE id = $1
       RETURNING id, name`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found."
      });
    }

    res.json({
      success: true,
      message: "Category removed successfully."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not remove category."
    });
  }
});


/* ========================================
   DELIVERY AREAS
======================================== */


/* GET DELIVERY AREAS */

router.get("/delivery-areas", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM delivery_areas
       ORDER BY area_name ASC`
    );

    res.json({
      success: true,
      delivery_areas: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load delivery areas."
    });
  }
});


/* ADD DELIVERY AREA */

router.post("/delivery-areas", adminOnly, async (req, res) => {
  try {
    const {
      area_name,
      delivery_charge,
      is_available
    } = req.body;

    if (!area_name || delivery_charge === undefined) {
      return res.status(400).json({
        success: false,
        message: "Area name and delivery charge are required."
      });
    }

    if (Number(delivery_charge) < 0) {
      return res.status(400).json({
        success: false,
        message: "Delivery charge cannot be negative."
      });
    }

    const result = await pool.query(
      `INSERT INTO delivery_areas
       (area_name, delivery_charge, is_available)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        area_name.trim(),
        Number(delivery_charge),
        is_available !== false
      ]
    );

    res.status(201).json({
      success: true,
      message: "Delivery area created successfully.",
      delivery_area: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This delivery area already exists."
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not create delivery area."
    });
  }
});


/* UPDATE DELIVERY AREA */

router.put("/delivery-areas/:id", adminOnly, async (req, res) => {
  try {
    const {
      area_name,
      delivery_charge,
      is_available
    } = req.body;

    if (delivery_charge !== undefined && Number(delivery_charge) < 0) {
      return res.status(400).json({
        success: false,
        message: "Delivery charge cannot be negative."
      });
    }

    const result = await pool.query(
      `UPDATE delivery_areas
       SET
         area_name = $1,
         delivery_charge = $2,
         is_available = $3,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [
        area_name,
        Number(delivery_charge),
        is_available !== false,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Delivery area not found."
      });
    }

    res.json({
      success: true,
      message: "Delivery area updated successfully.",
      delivery_area: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not update delivery area."
    });
  }
});


/* DELETE DELIVERY AREA */

router.delete("/delivery-areas/:id", adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE delivery_areas
       SET is_available = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, area_name`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Delivery area not found."
      });
    }

    res.json({
      success: true,
      message: "Delivery area disabled successfully."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not disable delivery area."
    });
  }
});


/* ========================================
   ADMIN DEFAULT SETTINGS
======================================== */


/* GET SETTINGS */

router.get("/settings", adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM admin_settings
       ORDER BY setting_key ASC`
    );

    res.json({
      success: true,
      settings: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load settings."
    });
  }
});


/* UPDATE SETTING */

router.put("/settings/:key", adminOnly, async (req, res) => {
  try {
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: "Setting value is required."
      });
    }

    const result = await pool.query(
      `INSERT INTO admin_settings
       (setting_key, setting_value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (setting_key)
       DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        req.params.key,
        value
      ]
    );

    res.json({
      success: true,
      message: "Setting updated successfully.",
      setting: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not update setting."
    });
  }
});


module.exports = router;
