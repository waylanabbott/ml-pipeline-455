import pandas as pd
import numpy as np

# ── Load ──
df = pd.read_csv("job_search_platform_efficacy_100k.csv")
print(f"Loaded: {df.shape[0]} rows, {df.shape[1]} columns")

# ── 1. Drop identifier column (not useful for analysis) ──
df = df.drop(columns=["Student_ID"])

# ── 2. Convert categorical columns to category dtype ──
cat_cols = [
    "University_Rating",
    "School_Size",
    "Region",
    "Major_Category",
    "Primary_Search_Platform",
    "Company_Size_Offered",
]
for col in cat_cols:
    df[col] = df[col].astype("category")

# Set ordinal ordering where meaningful
df["University_Rating"] = df["University_Rating"].cat.set_categories(
    ["Lower-tier", "Mid-tier", "Top-tier"], ordered=True
)
df["School_Size"] = df["School_Size"].cat.set_categories(
    ["Small", "Medium", "Large"], ordered=True
)

# ── 3. Cast binary / integer columns to proper types ──
df["Offer_Received"] = df["Offer_Received"].astype("int8")
df["Accepted_Offer"] = df["Accepted_Offer"].astype("Int8")          # nullable int (NaN-safe)
df["Role_Relevance"] = df["Role_Relevance"].astype("Int8")
df["Prior_Internships"] = df["Prior_Internships"].astype("int8")
df["Extra_Curricular_Activities"] = df["Extra_Curricular_Activities"].astype("int8")
df["Networking_Events_Attended"] = df["Networking_Events_Attended"].astype("int8")
df["Months_Searching"] = df["Months_Searching"].astype("int8")
df["First_Round_Interviews"] = df["First_Round_Interviews"].astype("int16")
df["Second_Round_Interviews"] = df["Second_Round_Interviews"].astype("int16")
df["Applications_Submitted"] = df["Applications_Submitted"].astype("int16")

# ── 4. Fill offer-related NaNs for no-offer rows with explicit values ──
#    These are structurally missing (no offer → no salary, etc.)
df.loc[df["Offer_Received"] == 0, "Time_to_Offer_Days"] = 0
df.loc[df["Offer_Received"] == 0, "Offer_Salary"] = 0
df.loc[df["Offer_Received"] == 0, "Role_Relevance"] = 0
df.loc[df["Offer_Received"] == 0, "Accepted_Offer"] = 0
df["Company_Size_Offered"] = df["Company_Size_Offered"].cat.add_categories("None")
df.loc[df["Offer_Received"] == 0, "Company_Size_Offered"] = "None"

# ── 5. Verify no remaining nulls ──
remaining_nulls = df.isnull().sum().sum()
print(f"Remaining nulls: {remaining_nulls}")

# ── 6. Save cleaned data ──
df.to_csv("job_search_cleaned.csv", index=False)
print(f"Saved: job_search_cleaned.csv ({df.shape[0]} rows, {df.shape[1]} columns)")

# ── Summary ──
print("\n── Column Types ──")
print(df.dtypes)
print(f"\n── Shape: {df.shape} ──")
print(f"\n── Sample ──")
print(df.head())
