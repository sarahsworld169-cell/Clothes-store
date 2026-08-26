const express = require("express");
const { Pool } = require("pg");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const adminProductRoutes = require("./routes/admin-products");
const reviewRoutes = require("./routes/reviews");

const app = express();

const PORT = process.env.PORT || 3000;

/* =========================
   DATABASE
========================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   API ROUTES
========================= */

app.use("/api/auth", authRoutes);

app.use("/api/products", productRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/admin/products", adminProductRoutes);

app.use("/api/reviews", reviewRoutes);

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "Sarah's World backend is running!",
      database: "Connected"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database connection failed."
    });
  }
});

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Sarah's World API 🚀"
  });
});

/* =========================
   404 HANDLER
========================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
});

/* =========================
   SERVER
========================= */

app.listen(PORT, () => {
  console.log(
    `Sarah's World server running on port ${PORT}`
  );
});
