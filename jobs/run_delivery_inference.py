"""
run_delivery_inference.py — Score unscored orders for late delivery probability.
"""

import sqlite3
import pickle
import pandas as pd
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
DB_PATH = BASE / ".." / "data" / "shop.db"
MODEL_PATH = BASE / "delivery_model.pkl"


def main():
    with open(MODEL_PATH, "rb") as f:
        bundle = pickle.load(f)
    clf, cat_cols, num_cols = bundle["pipeline"], bundle["categorical_cols"], bundle["numeric_cols"]

    conn = sqlite3.connect(DB_PATH)

    df = pd.read_sql("""
        SELECT o.order_id, o.order_total, o.payment_method, o.device_type, o.ip_country, o.promo_used,
               o.order_subtotal, o.shipping_fee, o.tax_amount,
               c.gender, c.customer_segment, c.loyalty_tier,
               s.carrier, s.shipping_method, s.distance_band, s.promised_days,
               oi_agg.num_items, oi_agg.num_distinct_products, oi_agg.avg_unit_price
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        LEFT JOIN shipments s ON o.order_id = s.order_id
        LEFT JOIN (
            SELECT order_id, SUM(quantity) AS num_items,
                   COUNT(DISTINCT product_id) AS num_distinct_products,
                   AVG(unit_price) AS avg_unit_price
            FROM order_items GROUP BY order_id
        ) oi_agg ON o.order_id = oi_agg.order_id
        WHERE o.order_id NOT IN (SELECT order_id FROM delivery_predictions)
    """, conn)

    if df.empty:
        print("No unscored orders found.")
        conn.close()
        return

    X = df[cat_cols + num_cols]
    probs = clf.predict_proba(X)[:, 1]
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

    print(f"Scored {len(results)} orders — {preds.sum()} predicted late ({preds.mean():.1%})")


if __name__ == "__main__":
    main()
