"""
train_model.py — ETL + fraud model training pipeline.
Run from the notebooks/ directory: python3 train_model.py
"""

import sqlite3
import pandas as pd
import numpy as np
import pickle
from pathlib import Path

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

DB_PATH = Path(__file__).resolve().parent / ".." / "data" / "shop.db"
MODEL_PATH = Path(__file__).resolve().parent / ".." / "jobs" / "model.pkl"

print(f"Database: {DB_PATH.resolve()}")

# ── 1. Extract ──────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)

customers = pd.read_sql("SELECT * FROM customers", conn)
orders = pd.read_sql("SELECT * FROM orders", conn)
order_items = pd.read_sql("SELECT * FROM order_items", conn)
shipments = pd.read_sql("SELECT * FROM shipments", conn)

print(f"customers:   {customers.shape}")
print(f"orders:      {orders.shape}")
print(f"order_items: {order_items.shape}")
print(f"shipments:   {shipments.shape}")

# ── 2. Transform ────────────────────────────────────────────
item_agg = (
    order_items.groupby("order_id")
    .agg(
        num_items=("quantity", "sum"),
        num_distinct_products=("product_id", "nunique"),
        avg_unit_price=("unit_price", "mean"),
        max_unit_price=("unit_price", "max"),
    )
    .reset_index()
)

warehouse = (
    orders
    .merge(customers[["customer_id", "gender", "customer_segment", "loyalty_tier", "state"]],
           on="customer_id", how="left", suffixes=("", "_cust"))
    .merge(item_agg, on="order_id", how="left")
    .merge(shipments[["order_id", "carrier", "shipping_method", "distance_band"]],
           on="order_id", how="left")
)

warehouse["zip_mismatch"] = (warehouse["billing_zip"] != warehouse["shipping_zip"]).astype(int)
warehouse["is_foreign_ip"] = (warehouse["ip_country"] != "US").astype(int)
warehouse["order_hour"] = pd.to_datetime(warehouse["order_datetime"]).dt.hour

print(f"\nWarehouse table: {warehouse.shape}")

# Write warehouse table to DB
warehouse.to_sql("warehouse_fraud", conn, if_exists="replace", index=False)
print("Wrote warehouse_fraud table to shop.db")

# ── 3. Train ────────────────────────────────────────────────
categorical_cols = [
    "payment_method", "device_type", "ip_country",
    "gender", "customer_segment", "loyalty_tier",
    "carrier", "shipping_method", "distance_band",
]

numeric_cols = [
    "order_subtotal", "shipping_fee", "tax_amount", "order_total",
    "risk_score", "promo_used",
    "num_items", "num_distinct_products", "avg_unit_price", "max_unit_price",
    "zip_mismatch", "is_foreign_ip", "order_hour",
]

target = "is_fraud"

X = warehouse[categorical_cols + numeric_cols].copy()
y = warehouse[target].copy()

print(f"\nFeatures: {X.shape[1]}  |  Fraud rate: {y.mean():.1%}")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"Train: {X_train.shape[0]}  |  Test: {X_test.shape[0]}")

preprocessor = ColumnTransformer(
    transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_cols),
        ("num", "passthrough", numeric_cols),
    ]
)

clf = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )),
])

clf.fit(X_train, y_train)
print("Model trained.")

# ── 4. Evaluate ─────────────────────────────────────────────
y_pred = clf.predict(X_test)
y_prob = clf.predict_proba(X_test)[:, 1]

print(f"\n{classification_report(y_test, y_pred, target_names=['Legit', 'Fraud'])}")
print(f"ROC-AUC: {roc_auc_score(y_test, y_prob):.4f}")

# ── 5. Save ─────────────────────────────────────────────────
with open(MODEL_PATH, "wb") as f:
    pickle.dump({
        "pipeline": clf,
        "categorical_cols": categorical_cols,
        "numeric_cols": numeric_cols,
    }, f)

print(f"\nModel saved to {MODEL_PATH.resolve()}")
conn.close()
print("Done. Run: python3 ../jobs/run_inference.py")
