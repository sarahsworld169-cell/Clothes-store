const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const reviewRoutes = require("./routes/reviews");
const notificationRoutes = require("./routes/notifications");

const adminProductRoutes = require("./routes/admin-products");
const adminOrderRoutes = require("./routes/admin-orders");
const adminUserRoutes = require("./routes/admin-users");
const adminSettingsRoutes = require("./routes/admin-settings");
const adminCategoryRoutes = require("./routes/admin-categories");

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

app.use("/api/reviews", reviewRoutes);

app.use("/api/notifications", notificationRoutes);


/* =========================
   ADMIN ROUTES
========================= */

app.use(
  "/api/admin/products",
  adminProductRoutes
);

app.use(
  "/api/admin/orders",
  adminOrderRoutes
);

app.use(
  "/api/admin/users",
  adminUserRoutes
);

app.use(
  "/api/admin/settings",
  adminSettingsRoutes
);


/* =========================
   ADMIN CATEGORIES
   DELIVERY AREAS
   SETTINGS
========================= */

app.use(
  "/api/admin",
  adminCategoryRoutes
);


/* =========================
   FRONTEND FILES
========================= */

app.use(express.static(__dirname));


/* =========================
   ADMIN FRONTEND
========================= */

app.use(
  "/admin",
  express.static(path.join(__dirname, "admin"))
);


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

    console.error("Database Error:", error);

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

  res.sendFile(
    path.join(__dirname, "index.html")
  );

});


/* =========================
   ADMIN HOME
========================= */

app.get("/admin", (req, res) => {

  res.sendFile(
    path.join(__dirname, "admin", "index.html")
  );

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
   ERROR HANDLER
========================= */

app.use((error, req, res, next) => {

  console.error("Server Error:", error);

  res.status(500).json({
    success: false,
    message: "Internal server error."
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
