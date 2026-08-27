-- =========================================
-- SARAH'S WORLD
-- PAYMENT SETTINGS MIGRATION
-- =========================================


-- =========================================
-- GLOBAL PAYMENT SETTINGS
-- =========================================

INSERT INTO admin_settings
(setting_key, setting_value)
VALUES
(
    'bkash_enabled',
    'true'
),
(
    'nagad_enabled',
    'true'
),
(
    'cod_enabled',
    'true'
),
(
    'payment_number',
    '01723679299'
),
(
    'default_delivery_charge',
    '0'
)
ON CONFLICT (setting_key) DO NOTHING;


-- =========================================
-- PRODUCT PAYMENT SETTINGS
-- Each product can control its own payment
-- methods like a marketplace.
-- =========================================

ALTER TABLE products
ADD COLUMN IF NOT EXISTS allow_bkash BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS allow_nagad BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS allow_cod BOOLEAN NOT NULL DEFAULT TRUE;


-- =========================================
-- ORDER CANCELLATION
-- Seller/Admin custom reason support
-- =========================================

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS cancelled_by INTEGER
REFERENCES users(id)
ON DELETE SET NULL;


-- =========================================
-- PAYMENT METHOD INDEX
-- =========================================

CREATE INDEX IF NOT EXISTS idx_payments_order
ON payments(order_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
ON payments(payment_status);


-- =========================================
-- DONE
-- =========================================
