-- =========================================
-- Sarah's World Database Schema
-- =========================================


-- =========================================
-- USERS
-- =========================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    phone VARCHAR(20),

    role VARCHAR(20) NOT NULL DEFAULT 'customer',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- PRODUCTS
-- =========================================

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    price INTEGER NOT NULL CHECK (price >= 0),

    image_url TEXT,

    category VARCHAR(100),

    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- ORDERS
-- =========================================

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id),

    total_amount INTEGER NOT NULL
        CHECK (total_amount >= 0),

    payment_method VARCHAR(50),

    payment_status VARCHAR(50)
        NOT NULL DEFAULT 'pending',

    order_status VARCHAR(50)
        NOT NULL DEFAULT 'pending',

    delivery_address TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- ORDER ITEMS
-- =========================================

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,

    order_id INTEGER NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,

    product_id INTEGER NOT NULL
        REFERENCES products(id),

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    price INTEGER NOT NULL
        CHECK (price >= 0)
);
