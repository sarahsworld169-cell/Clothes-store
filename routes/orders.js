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
   CREATE ORDER
========================= */

router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      user_id,
      items,
      payment_method,
      delivery_address
    } = req.body;

    if (!user_id || !items || !items.length || !delivery_address) {
      return res.status(400).json({
        success: false,
        message: "Missing order information."
      });
    }

    await client.query("BEGIN");

    let totalAmount = 0;
    const orderItems = [];

    /* Check products and calculate total */

    for (const item of items) {

      const productResult = await client.query(
        "SELECT id, price, stock FROM products WHERE id = $1",
        [item.product_id]
      );

      if (productResult.rows.length === 0) {
        throw new Error("Product not found.");
      }

      const product = productResult.rows[0];

      if (product.stock < item.quantity) {
        throw new Error(
          `Not enough stock for product ${product.id}.`
        );
      }

      totalAmount += product.price * item.quantity;

      orderItems.push({
        product_id: product.id,
        quantity: item.quantity,
        price: product.price
      });
    }

    /* Create order */

    const orderResult = await client.query(
      `INSERT INTO orders
       (user_id, total_amount, payment_method, delivery_address)
       VALUES ($1, $2, $3, $4)
       RETURNING id, total_amount, payment_method,
                 payment_status, order_status,
                 delivery_address, created_at`,
      [
        user_id,
        totalAmount,
        payment_method || null,
        delivery_address
      ]
    );

    const order = orderResult.rows[0];

    /* Add order items + reduce stock */

    for (const item of orderItems) {

      await client.query(
        `INSERT INTO order_items
         (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [
          order.id,
          item.product_id,
          item.quantity,
          item.price
        ]
      );

      await client.query(
        `UPDATE products
         SET stock = stock - $1
         WHERE id = $2`,
        [
          item.quantity,
          item.product_id
        ]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Order created successfully.",
      order: order
    });

  } catch (error) {

    await client.query("ROLLBACK");

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message || "Could not create order."
    });

  } finally {

    client.release();

  }
});


/* =========================
   GET USER ORDERS
========================= */

router.get("/user/:userId", async (req, res) => {

  try {

    const result = await pool.query(
      `SELECT *
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.params.userId]
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


module.exports = router;
