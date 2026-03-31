"""
train_delivery_model.py — Train late delivery prediction model for the web app.
"""

import sqlite3
import pandas as pd
import pickle
from pathlib import Path

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

DB_PATH = Path(__file__).resolve().parent / ".." / "data" / "shop.db"
MODEL_PATH = Path(__file__).resolve().parent / ".." / "jobs" / "delivery_model.pkl"

conn = sqlite3.connect(DB_PATH)

# Build feature table
query = """
SELECT
    o.order_id, o.order_total, o.payment_method, o.device_type, o.ip_country, o.promo_used,
    o.order_subtotal, o.shipping_fee, o.tax_amount,
    c.gender, c.customer_segment, c.loyalty_tier,
    s.carrier, s.shipping_method, s.distance_band, s.promised_days,
    s.late_delivery,
    oi_agg.num_items, oi_agg.num_distinct_products, oi_agg.avg_unit_price
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
JOIN shipments s ON o.order_id = s.order_id
LEFT JOIN (
    SELECT order_id,
           SUM(quantity) AS num_items,
           COUNT(DISTINCT product_id) AS num_distinct_products,
           AVG(unit_price) AS avg_unit_price
    FROM order_items GROUP BY order_id
) oi_agg ON o.order_id = oi_agg.order_id
"""
df = pd.read_sql(query, conn)
print(f"Rows: {len(df)}  |  Late delivery rate: {df['late_delivery'].mean():.1%}")

cat_cols = ["payment_method", "device_type", "carrier", "shipping_method",
            "distance_band", "gender", "customer_segment", "loyalty_tier"]
num_cols = ["order_total", "order_subtotal", "shipping_fee", "tax_amount",
            "promo_used", "promised_days", "num_items", "num_distinct_products", "avg_unit_price"]

X = df[cat_cols + num_cols]
y = df["late_delivery"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

preprocessor = ColumnTransformer([
    ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
    ("num", "passthrough", num_cols),
])

clf = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42, n_jobs=-1)),
])

clf.fit(X_train, y_train)

y_pred = clf.predict(X_test)
y_prob = clf.predict_proba(X_test)[:, 1]
print(classification_report(y_test, y_pred, target_names=["On-Time", "Late"]))
print(f"ROC-AUC: {roc_auc_score(y_test, y_prob):.4f}")

with open(MODEL_PATH, "wb") as f:
    pickle.dump({"pipeline": clf, "categorical_cols": cat_cols, "numeric_cols": num_cols}, f)

# Also create delivery_predictions table and score everything
conn.execute("""CREATE TABLE IF NOT EXISTS delivery_predictions (
    prediction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL UNIQUE,
    late_probability REAL NOT NULL,
    predicted_late INTEGER NOT NULL,
    scored_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
)""")
conn.execute("DELETE FROM delivery_predictions")

from datetime import datetime
X_all = df[cat_cols + num_cols]
probs = clf.predict_proba(X_all)[:, 1]
preds = (probs >= 0.5).astype(int)

results = pd.DataFrame({
    "order_id": df["order_id"],
    "late_probability": probs.round(4),
    "predicted_late": preds,
    "scored_at": datetime.now().isoformat(),
})
results.to_sql("delivery_predictions", conn, if_exists="append", index=False)
conn.commit()
conn.close()

print(f"\nModel saved to {MODEL_PATH}")
print(f"Scored {len(results)} orders — {preds.sum()} predicted late ({preds.mean():.1%})")
