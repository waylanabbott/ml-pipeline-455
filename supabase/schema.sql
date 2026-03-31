-- Supabase schema for shop.db migration
-- Run this in the Supabase SQL Editor to create all tables

CREATE TABLE IF NOT EXISTS customers (
  customer_id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  gender TEXT NOT NULL,
  birthdate TEXT NOT NULL,
  created_at TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  customer_segment TEXT,
  loyalty_tier TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  product_id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  cost REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  order_datetime TEXT NOT NULL,
  billing_zip TEXT,
  shipping_zip TEXT,
  shipping_state TEXT,
  payment_method TEXT NOT NULL,
  device_type TEXT NOT NULL,
  ip_country TEXT NOT NULL,
  promo_used INTEGER NOT NULL DEFAULT 0,
  promo_code TEXT,
  order_subtotal REAL NOT NULL,
  shipping_fee REAL NOT NULL,
  tax_amount REAL NOT NULL,
  order_total REAL NOT NULL,
  risk_score REAL NOT NULL,
  is_fraud INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS shipments (
  shipment_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(order_id),
  ship_datetime TEXT NOT NULL,
  carrier TEXT NOT NULL,
  shipping_method TEXT NOT NULL,
  distance_band TEXT NOT NULL,
  promised_days INTEGER NOT NULL,
  actual_days INTEGER NOT NULL,
  late_delivery INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_reviews (
  review_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_datetime TEXT NOT NULL,
  review_text TEXT,
  UNIQUE(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS order_predictions (
  prediction_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(order_id),
  fraud_probability REAL NOT NULL,
  predicted_fraud INTEGER NOT NULL,
  scored_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_predictions (
  prediction_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(order_id),
  late_probability REAL NOT NULL,
  predicted_late INTEGER NOT NULL,
  scored_at TEXT NOT NULL
);

-- Enable Row Level Security but allow anonymous reads
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_predictions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (for class project)
CREATE POLICY "Allow anonymous read" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read" ON products FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow anonymous all" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON order_items FOR SELECT USING (true);
CREATE POLICY "Allow anonymous all" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON shipments FOR SELECT USING (true);
CREATE POLICY "Allow anonymous all" ON shipments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON product_reviews FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read" ON order_predictions FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read" ON delivery_predictions FOR SELECT USING (true);
