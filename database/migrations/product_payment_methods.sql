-- =========================================
-- SARAH'S WORLD
-- PRODUCT PAYMENT METHODS
-- =========================================

ALTER TABLE products
ADD COLUMN IF NOT EXISTS allow_bkash BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS allow_nagad BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS allow_cod BOOLEAN NOT NULL DEFAULT TRUE;
