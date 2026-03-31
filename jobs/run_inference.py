"""
run_inference.py — Score unscored orders for fraud probability.

Usage:
    python jobs/run_inference.py

Reads model.pkl, loads unscored orders from shop.db,
generates predictions, writes results to order_predictions table.
"""

import sqlite3
import pickle
import pandas as pd
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
DB_PATH = BASE / ".." / "data" / "shop.db"
MODEL_PATH = BASE / "model.pkl"


def load_model():
    with open(MODEL_PATH, "rb") as f:
        bundle = pickle.load(f)
    return bundle["pipeline"], bundle["categorical_cols"], bundle["numeric_cols"]


def get_unscored_orders(conn):
    """Get orders that don't yet have a prediction."""
    query = """
    SELECT
        o.*,
        c.gender, c.customer_segment, c.loyalty_tier,
        oi_agg.num_items, oi_agg.num_distinct_products,
        oi_agg.avg_unit_price, oi_agg.max_unit_price,
        s.carrier, s.shipping_method, s.distance_band
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    LEFT JOIN (
        SELECT order_id,
               SUM(quantity) AS num_items,
               COUNT(DISTINCT product_id) AS num_distinct_products,
               AVG(unit_price) AS avg_unit_price,
               MAX(unit_price) AS max_unit_price
        FROM order_items
        GROUP BY order_id
    ) oi_agg ON o.order_id = oi_agg.order_id
    LEFT JOIN shipments s ON o.order_id = s.order_id
    WHERE o.order_id NOT IN (SELECT order_id FROM order_predictions)
    """
    return pd.read_sql(query, conn)


def engineer_features(df):
    """Apply the same feature engineering as training."""
    df["zip_mismatch"] = (df["billing_zip"] != df["shipping_zip"]).astype(int)
    df["is_foreign_ip"] = (df["ip_country"] != "US").astype(int)
    df["order_hour"] = pd.to_datetime(df["order_datetime"]).dt.hour
    return df


def main():
    clf, cat_cols, num_cols = load_model()
    conn = sqlite3.connect(DB_PATH)

    df = get_unscored_orders(conn)
    if df.empty:
        print("No unscored orders found.")
        conn.close()
        return

    df = engineer_features(df)
    X = df[cat_cols + num_cols]

    probs = clf.predict_proba(X)[:, 1]
    preds = (probs >= 0.5).astype(int)

    results = pd.DataFrame({
        "order_id": df["order_id"],
        "fraud_probability": probs.round(4),
        "predicted_fraud": preds,
        "scored_at": datetime.now().isoformat(),
    })

    results.to_sql("order_predictions", conn, if_exists="append", index=False)
    conn.close()

    fraud_count = preds.sum()
    print(f"Scored {len(results)} orders — {fraud_count} flagged as fraud ({fraud_count/len(results):.1%})")


if __name__ == "__main__":
    main()
