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
   GET ALL ORDERS
========================= */

router.get("/", adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         o.*,
         u.name AS customer_name,
         u.email AS customer_email,
         u.phone AS customer_phone,
         da.area_name
       FROM orders o
       JOIN users u
         ON o.user_id = u.id
       LEFT JOIN delivery_areas da
         ON o.delivery_area_id = da.id
       ORDER BY o.created_at DESC`
    );

    res.json({
      success: true,
      orders: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load orders."
    });
  }
});


/* =========================
   GET SINGLE ORDER
   FULL DETAILS
========================= */

router.get("/:id", adminOnly, async (req, res) => {
  try {

    const orderResult = await pool.query(
      `SELECT
         o.*,
         u.name AS customer_name,
         u.email AS customer_email,
         u.phone AS customer_phone,
         da.area_name
       FROM orders o
       JOIN users u
         ON o.user_id = u.id
       LEFT JOIN delivery_areas da
         ON o.delivery_area_id = da.id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    const order = orderResult.rows[0];


    /* =========================
       ORDER ITEMS
    ========================= */

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


    /* =========================
       PAYMENT
    ========================= */

    const paymentResult = await pool.query(
      `SELECT *
       FROM payments
       WHERE order_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [order.id]
    );


    res.json({
      success: true,

      order: {
        ...order,

        items: itemsResult.rows,

        payment: paymentResult.rows[0] || null
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load order details."
    });
  }
});


/* =========================
   ACCEPT ORDER
========================= */

router.post("/:id/accept", adminOnly, async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("BEGIN");


    /* =========================
       CHECK ORDER
    ========================= */

    const orderResult = await client.query(
      `SELECT *
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {

      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    const order = orderResult.rows[0];


    if (order.order_status !== "pending") {

      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: `Order is already ${order.order_status}.`
      });
    }


    /* =========================
       UPDATE ORDER
    ========================= */

    const updatedOrder = await client.query(
      `UPDATE orders
       SET
         order_status = 'accepted',
         accepted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );


    /* =========================
       CUSTOMER NOTIFICATION
    ========================= */

    const settingResult = await client.query(
      `SELECT setting_value
       FROM admin_settings
       WHERE setting_key = 'default_accept_message'`
    );

    const message =
      settingResult.rows.length > 0
        ? settingResult.rows[0].setting_value
        : "Your order has been accepted and is now being processed.";


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
       ($1,$2,$3,$4,'order_accepted')`,
      [
        order.user_id,
        order.id,
        "✅ Order Accepted",
        message
      ]
    );


    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Order accepted successfully.",
      order: updatedOrder.rows[0]
    });

  } catch (error) {

    await client.query("ROLLBACK");

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not accept order."
    });

  } finally {
    client.release();
  }
});


/* =========================
   CANCEL ORDER
========================= */

router.post("/:id/cancel", adminOnly, async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("BEGIN");


    /* =========================
       CHECK ORDER
    ========================= */

    const orderResult = await client.query(
      `SELECT *
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {

      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    const order = orderResult.rows[0];


    if (
      order.order_status === "cancelled" ||
      order.order_status === "delivered"
    ) {

      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled."
      });
    }


    /* =========================
       CUSTOM / DEFAULT REASON
    ========================= */

    let cancellationReason =
      typeof req.body.reason === "string"
        ? req.body.reason.trim()
        : "";


    if (!cancellationReason) {

      const settingResult = await client.query(
        `SELECT setting_value
         FROM admin_settings
         WHERE setting_key = 'default_cancel_reason'`
      );

      cancellationReason =
        settingResult.rows.length > 0
          ? settingResult.rows[0].setting_value
          : "Sorry, your order could not be processed at this time.";
    }


    /* =========================
       UPDATE ORDER
    ========================= */

    const updatedOrder = await client.query(
      `UPDATE orders
       SET
         order_status = 'cancelled',
         cancellation_reason = $1,
         cancelled_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [
        cancellationReason,
        req.params.id
      ]
    );


    /* =========================
       CUSTOMER NOTIFICATION
    ========================= */

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
       ($1,$2,$3,$4,'order_cancelled')`,
      [
        order.user_id,
        order.id,
        "❌ Order Cancelled",
        `Your order #${order.id} has been cancelled. Reason: ${cancellationReason}`
      ]
    );


    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Order cancelled successfully.",
      cancellation_reason: cancellationReason,
      order: updatedOrder.rows[0]
    });

  } catch (error) {

    await client.query("ROLLBACK");

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not cancel order."
    });

  } finally {
    client.release();
  }
});


/* =========================
   UPDATE ORDER STATUS
========================= */

router.patch("/:id/status", adminOnly, async (req, res) => {

  const client = await pool.connect();

  try {

    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "accepted",
      "processing",
      "shipped",
      "delivered",
      "cancelled"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status."
      });
    }

    await client.query("BEGIN");


    /* =========================
       GET ORDER
    ========================= */

    const orderResult = await client.query(
      `SELECT *
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {

      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    const order = orderResult.rows[0];


    /* =========================
       UPDATE
    ========================= */

    let extraFields = "";

    if (status === "delivered") {
      extraFields = ", delivered_at = CURRENT_TIMESTAMP";
    }

    const result = await client.query(
      `UPDATE orders
       SET
         order_status = $1,
         updated_at = CURRENT_TIMESTAMP
         ${extraFields}
       WHERE id = $2
       RETURNING *`,
      [
        status,
        req.params.id
      ]
    );


    /* =========================
       CUSTOMER NOTIFICATION
    ========================= */

    const titleMap = {
      accepted: "✅ Order Accepted",
      processing: "⚙️ Order Processing",
      shipped: "🚚 Order Shipped",
      delivered: "🎉 Order Delivered",
      pending: "⏳ Order Pending"
    };

    const messageMap = {
      accepted: "Your order has been accepted.",
      processing: "Your order is now being processed.",
      shipped: "Your order has been shipped.",
      delivered: "Your order has been delivered.",
      pending: "Your order is pending."
    };

    if (titleMap[status]) {

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
         ($1,$2,$3,$4,'order_status')`,
        [
          order.user_id,
          order.id,
          titleMap[status],
          messageMap[status]
        ]
      );
    }


    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Order status updated successfully.",
      order: result.rows[0]
    });

  } catch (error) {

    await client.query("ROLLBACK");

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not update order status."
    });

  } finally {
    client.release();
  }
});


module.exports = router;
