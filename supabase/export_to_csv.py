"""
Export shop.db tables to CSV files for Supabase import.
Run: python3 supabase/export_to_csv.py

Then import CSVs via Supabase Dashboard > Table Editor > Import CSV
Import in this order: customers, products, orders, order_items, shipments,
product_reviews, order_predictions, delivery_predictions
"""

import sqlite3
import pandas as pd
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / ".." / "data" / "shop.db"
OUT_DIR = Path(__file__).resolve().parent / "csv"
OUT_DIR.mkdir(exist_ok=True)

conn = sqlite3.connect(DB_PATH)

tables = [
    "customers", "products", "orders", "order_items",
    "shipments", "product_reviews", "order_predictions", "delivery_predictions",
]

for table in tables:
    df = pd.read_sql(f"SELECT * FROM {table}", conn)
    out = OUT_DIR / f"{table}.csv"
    df.to_csv(out, index=False)
    print(f"{table}: {len(df)} rows → {out.name}")

conn.close()
print(f"\nCSV files written to {OUT_DIR}")
print("Import to Supabase in this order: customers → products → orders → order_items → shipments → product_reviews → order_predictions → delivery_predictions")
