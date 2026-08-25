const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   POSTGRESQL
========================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* =========================
   TEST DATABASE
========================= */

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message: "Sarah's World backend is running!",
      database: "Connected",
      time: result.rows[0].now
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
});

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.send("Sarah's World API is running 🚀");
});

/* =========================
   PRODUCTS API
========================= */

app.get("/api/products", async (req, res) => {
  try {

    const result = await pool.query(
      "SELECT * FROM products ORDER BY id DESC"
    );

    res.json({
      success: true,
      products: result.rows
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load products"
    });

  }
});

/* =========================
   SERVER
========================= */

app.listen(PORT, () => {
  console.log(`Sarah's World server running on port ${PORT}`);
});
