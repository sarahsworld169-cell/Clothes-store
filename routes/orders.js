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
   CREATE ORDER
========================= */

router.post("/", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      items,
      delivery_area_id,
      delivery_address,
      payment_method
    } = req.body;

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      !delivery_area_id ||
      !delivery_address ||
      !payment_method
    ) {
      return res.status(400).json({
        success: false,
        message: "Items, delivery area, address and payment method are required."
      });
    }

    const allowedPayments = [
      "bkash",
      "nagad",
      "cod"
    ];

    if (!allowedPayments.includes(payment_method.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method."
      });
    }

    await client.query("BEGIN");


    /* =========================
       CHECK DELIVERY AREA
    ========================= */

    const deliveryResult = await client.query(
      `SELECT *
       FROM delivery_areas
       WHERE id = $1
         AND is_available = TRUE`,
      [delivery_area_id]
    );

    if (deliveryResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Delivery is not available in this area."
      });
    }

    const deliveryArea = deliveryResult.rows[0];


    /* =========================
       CHECK PRODUCTS
    ========================= */

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {

      if (!item.product_id || !item.quantity) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "Invalid product information."
        });
      }

      if (Number(item.quantity) <= 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "Quantity must be greater than zero."
        });
      }

      const productResult = await client.query(
        `SELECT *
         FROM products
         WHERE id = $1
           AND is_active = TRUE`,
        [item.product_id]
      );

      if (productResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: `Product ${item.product_id} not found.`
        });
      }

      const product = productResult.rows[0];

      if (product.stock < Number(item.quantity)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: `${product.name} does not have enough stock.`
        });
      }

      const finalPrice =
        product.discount_price !== null
          ? product.discount_price
          : product.price;

      const itemTotal =
        Number(finalPrice) * Number(item.quantity);

      subtotal += itemTotal;

      orderItems.push({
        product,
        quantity: Number(item.quantity),
        price: Number(finalPrice),
        selected_size: item.selected_size || null,
        selected_color: item.selected_color || null
      });
    }


    /* =========================
       TOTAL
    ========================= */

    const deliveryCharge =
      Number(deliveryArea.delivery_charge);

    const totalAmount =
      subtotal + deliveryCharge;


    /* =========================
       CREATE ORDER
    ========================= */

    const orderResult = await client.query(
      `INSERT INTO orders
       (
         user_id,
         delivery_area_id,
         delivery_address,
         subtotal,
         delivery_charge,
         total_amount,
         payment_method,
         payment_status,
         order_status
       )
       VALUES
       ($1,$2,$3,$4,$5,$6,$7,'pending','pending')
       RETURNING *`,
      [
        req.user.id,
        delivery_area_id,
        delivery_address,
        subtotal,
        deliveryCharge,
        totalAmount,
        payment_method.toLowerCase()
      ]
    );

    const order = orderResult.rows[0];


    /* =========================
       CREATE ORDER ITEMS
    ========================= */

    for (const item of orderItems) {

      await client.query(
        `INSERT INTO order_items
         (
           order_id,
           product_id,
           product_name,
           quantity,
           price,
           selected_size,
           selected_color
         )
         VALUES
         ($1,$2,$3,$4,$5,$6,$7)`,
        [
          order.id,
          item.product.id,
          item.product.name,
          item.quantity,
          item.price,
          item.selected_size,
          item.selected_color
        ]
      );
    }


    /* =========================
       CREATE PAYMENT RECORD
    ========================= */

    await client.query(
      `INSERT INTO payments
       (
         order_id,
         payment_method,
         amount,
         payment_status
       )
       VALUES
       ($1,$2,$3,'pending')`,
      [
        order.id,
        payment_method.toLowerCase(),
        totalAmount
      ]
    );


    /* =========================
       ADMIN NOTIFICATION
    ========================= */

    const admins = await client.query(
      `SELECT id
       FROM users
       WHERE role = 'admin'
         AND status = 'active'`
    );

    for (const admin of admins.rows) {

      await client.query(
        `INSERT INTO notifications
         (
           user_id,
           order_id,
           title,
           message,
           type
         )
         VALUES
         (
           $1,
           $2,
           $3,
           $4,
           'new_order'
         )`,
        [
          admin.id,
          order.id,
          "🛍️ New Order Received!",
          `New order #${order.id} has been placed. Please review and accept or cancel the order.`
        ]
      );
    }


    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      order: {
        id: order.id,
        subtotal,
        delivery_charge: deliveryCharge,
        total_amount: totalAmount,
        payment_method,
        payment_status: "pending",
        order_status: "pending"
      }
    });

  } catch (error) {

    await client.query("ROLLBACK");

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not place order."
    });

  } finally {
    client.release();
  }
});


/* =========================
   GET MY ORDERS
========================= */

router.get("/my", authenticate, async (req, res) => {
  try {

    const ordersResult = await pool.query(
      `SELECT
         o.*,
         da.area_name
       FROM orders o
       LEFT JOIN delivery_areas da
         ON o.delivery_area_id = da.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    const orders = [];

    for (const order of ordersResult.rows) {

      const itemsResult = await pool.query(
        `SELECT
           oi.*,
           p.image_url
         FROM order_items oi
         LEFT JOIN products p
           ON oi.product_id = p.id
         WHERE oi.order_id = $1
         ORDER BY oi.id ASC`,
        [order.id]
      );

      orders.push({
        ...order,
        items: itemsResult.rows
      });
    }

    res.json({
      success: true,
      orders
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load your orders."
    });
  }
});


/* =========================
   GET SINGLE MY ORDER
========================= */

router.get("/:id", authenticate, async (req, res) => {
  try {

    const orderResult = await pool.query(
      `SELECT
         o.*,
         da.area_name
       FROM orders o
       LEFT JOIN delivery_areas da
         ON o.delivery_area_id = da.id
       WHERE o.id = $1
         AND o.user_id = $2`,
      [
        req.params.id,
        req.user.id
      ]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT
         oi.*,
         p.image_url,
         p.video_url
       FROM order_items oi
       LEFT JOIN products p
         ON oi.product_id = p.id
       WHERE oi.order_id = $1
       ORDER BY oi.id ASC`,
      [order.id]
    );

    res.json({
      success: true,
      order: {
        ...order,
        items: itemsResult.rows
      }
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load order."
    });
  }
});


module.exports = router;
