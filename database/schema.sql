-- =========================================
-- SARAH'S WORLD
-- COMPLETE DATABASE SCHEMA
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

    role VARCHAR(20) NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'admin')),

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'banned')),

    ban_reason TEXT,

    banned_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- PRODUCT CATEGORIES
-- =========================================

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,

    description TEXT,

    image_url TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- PRODUCTS
-- =========================================

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    price INTEGER NOT NULL
        CHECK (price >= 0),

    discount_price INTEGER
        CHECK (discount_price IS NULL OR discount_price >= 0),

    image_url TEXT,

    video_url TEXT,

    category_id INTEGER
        REFERENCES categories(id)
        ON DELETE SET NULL,

    stock INTEGER NOT NULL DEFAULT 0
        CHECK (stock >= 0),

    sizes TEXT,

    colors TEXT,

    is_featured BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- PRODUCT IMAGES
-- Multiple photos for one product
-- =========================================

CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,

    product_id INTEGER NOT NULL
        REFERENCES products(id)
        ON DELETE CASCADE,

    image_url TEXT NOT NULL,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- DELIVERY AREAS
-- Admin controls delivery areas & charges
-- =========================================

CREATE TABLE IF NOT EXISTS delivery_areas (
    id SERIAL PRIMARY KEY,

    area_name VARCHAR(150) NOT NULL UNIQUE,

    delivery_charge INTEGER NOT NULL DEFAULT 0
        CHECK (delivery_charge >= 0),

    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- ORDERS
-- =========================================

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id),

    delivery_area_id INTEGER
        REFERENCES delivery_areas(id)
        ON DELETE SET NULL,

    delivery_address TEXT NOT NULL,

    subtotal INTEGER NOT NULL
        CHECK (subtotal >= 0),

    delivery_charge INTEGER NOT NULL DEFAULT 0
        CHECK (delivery_charge >= 0),

    total_amount INTEGER NOT NULL
        CHECK (total_amount >= 0),

    payment_method VARCHAR(50) NOT NULL,

    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',

    order_status VARCHAR(50) NOT NULL DEFAULT 'pending',

    cancellation_reason TEXT,

    cancelled_at TIMESTAMP,

    accepted_at TIMESTAMP,

    delivered_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    product_name VARCHAR(255) NOT NULL,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    price INTEGER NOT NULL
        CHECK (price >= 0),

    selected_size VARCHAR(50),

    selected_color VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- PAYMENTS
-- =========================================

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,

    order_id INTEGER NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,

    payment_method VARCHAR(50) NOT NULL,

    amount INTEGER NOT NULL
        CHECK (amount >= 0),

    transaction_id VARCHAR(255),

    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',

    paid_at TIMESTAMP,

    verified_at TIMESTAMP,

    verified_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    refund_status VARCHAR(50) NOT NULL DEFAULT 'not_required',

    refund_amount INTEGER DEFAULT 0
        CHECK (refund_amount >= 0),

    refund_note TEXT,

    refunded_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- ORDER NOTIFICATIONS
-- Admin / Customer notifications
-- =========================================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(id)
        ON DELETE CASCADE,

    order_id INTEGER
        REFERENCES orders(id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,

    message TEXT NOT NULL,

    type VARCHAR(50) NOT NULL DEFAULT 'general',

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- REVIEWS
-- =========================================

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,

    product_id INTEGER NOT NULL
        REFERENCES products(id)
        ON DELETE CASCADE,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    rating INTEGER NOT NULL
        CHECK (rating >= 1 AND rating <= 5),

    review_text TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(product_id, user_id)
);


-- =========================================
-- ADMIN SETTINGS
-- Default cancellation message etc.
-- =========================================

CREATE TABLE IF NOT EXISTS admin_settings (
    id SERIAL PRIMARY KEY,

    setting_key VARCHAR(100) NOT NULL UNIQUE,

    setting_value TEXT,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- DEFAULT ADMIN SETTINGS
-- =========================================

INSERT INTO admin_settings
(setting_key, setting_value)
VALUES
(
    'default_cancel_reason',
    'Sorry, your order could not be processed at this time.'
),
(
    'default_accept_message',
    'Your order has been accepted and is now being processed.'
)
ON CONFLICT (setting_key) DO NOTHING;


-- =========================================
-- INDEXES
-- Helps search/order performance
-- =========================================

CREATE INDEX IF NOT EXISTS idx_products_name
ON products(name);

CREATE INDEX IF NOT EXISTS idx_products_category
ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_orders_user
ON orders(user_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders(order_status);

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_product
ON reviews(product_id);
