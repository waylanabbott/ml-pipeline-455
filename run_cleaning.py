#!/usr/bin/env python3
# Data Cleaning Automation Pipeline

import pandas as pd
import numpy as np
from scipy import stats
from scipy.stats import yeojohnson
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

print("=" * 60)
print("Starting Data Cleaning Pipeline...")
print("=" * 60)
print()

# Load the data
df = pd.read_csv('/Users/waylansmac/Desktop/455/last_mile_delivery_stops_1000.csv')
print(f"✅ Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")

# QUESTION 10: wrangle_basic
def wrangle_basic(df):
    """Clean categorical text fields to eliminate data quality issues."""
    df = df.copy()
    cols_to_clean = ['hub', 'delivery_zone', 'delivery_note', 'customer_type',
                     'priority_level', 'weather', 'delivery_status', 'failure_reason']

    for col in cols_to_clean:
        if col in df.columns:
            cleaned_col = col + '_clean'
            df[cleaned_col] = (df[col]
                              .astype(str)
                              .str.strip()
                              .str.lower()
                              .str.replace(r'\s+', ' ', regex=True)
                              .replace('nan', np.nan))
    return df

df = wrangle_basic(df)
failed_count = (df['delivery_status_clean'] == 'failed').sum()
print(f"✅ Question 10 Complete: {failed_count} failed deliveries identified")

# QUESTION 11: add_datetime_features
def add_datetime_features(df):
    """Parse messy datetime strings and create time-based analytical features."""
    df = df.copy()
    datetime_cols = ['stop_datetime_raw', 'scheduled_window_start_raw']

    for col in datetime_cols:
        if col in df.columns:
            parsed_col = col.replace('_raw', '_parsed')
            df[parsed_col] = pd.to_datetime(df[col], errors='coerce', infer_datetime_format=True)

    if 'scheduled_window_start_parsed' in df.columns:
        df['day_of_week'] = df['scheduled_window_start_parsed'].dt.dayofweek
        df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
        df['scheduled_min'] = (df['scheduled_window_start_parsed'].dt.hour * 60 +
                               df['scheduled_window_start_parsed'].dt.minute)

        if 'actual_arrival_min' in df.columns and 'scheduled_window_min' in df.columns:
            df['lateness_min'] = np.maximum(0, df['actual_arrival_min'] - df['scheduled_window_min'])

    return df

df = add_datetime_features(df)
lateness_mean = df['lateness_min'].mean()
print(f"✅ Question 11 Complete: Mean lateness = {lateness_mean:.2f} minutes")

# QUESTION 12: bin_rare_categories
def bin_rare_categories(df, cols=None, min_prop=0.05, suffix='_binned'):
    """Consolidate infrequent categories to reduce cardinality."""
    df = df.copy()

    if cols is None:
        cols = df.select_dtypes(include=['object']).columns.tolist()
    elif isinstance(cols, str):
        cols = [cols]

    for col in cols:
        if col not in df.columns:
            continue
        value_counts = df[col].value_counts(dropna=False)
        total_rows = len(df)
        proportions = value_counts / total_rows
        rare_categories = proportions[proportions < min_prop].index.tolist()
        binned_col = col + suffix
        df[binned_col] = df[col].copy()
        df.loc[df[col].isin(rare_categories), binned_col] = 'Other'

    return df

df = bin_rare_categories(df, cols='delivery_zone_clean')
unique_count = df['delivery_zone_clean_binned'].nunique()
print(f"✅ Question 12 Complete: {unique_count} unique categories after binning")

# QUESTION 13: transform_skew
def transform_skew(df, features=None, suffix='_skewfix'):
    """Reduce skew in numeric columns by automatically selecting the best transformation."""
    df = df.copy()

    if features is None:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        features = [col for col in numeric_cols if df[col].dropna().nunique() > 2]
    elif isinstance(features, str):
        features = [features]

    for col in features:
        if col not in df.columns:
            continue

        data = df[col].dropna()
        if len(data) == 0:
            continue

        transformations = {}
        transformations['none'] = (data, abs(data.skew()))

        if data.min() >= 0:
            transformations['log1p'] = (np.log1p(data), abs(np.log1p(data).skew()))
        else:
            shifted = data - data.min()
            transformations['log1p'] = (np.log1p(shifted), abs(np.log1p(shifted).skew()))

        if data.min() >= 0:
            transformations['sqrt'] = (np.sqrt(data), abs(np.sqrt(data).skew()))
        else:
            shifted = data - data.min()
            transformations['sqrt'] = (np.sqrt(shifted), abs(np.sqrt(shifted).skew()))

        transformations['cbrt'] = (np.cbrt(data), abs(np.cbrt(data).skew()))
        transformations['square'] = (data ** 2, abs((data ** 2).skew()))

        try:
            transformed_yj, _ = yeojohnson(data)
            transformations['yeojohnson'] = (pd.Series(transformed_yj, index=data.index),
                                            abs(pd.Series(transformed_yj).skew()))
        except:
            pass

        best_transform = min(transformations.items(), key=lambda x: (x[1][1], x[0]))
        transformed_col = col + suffix

        if best_transform[0] == 'none':
            df[transformed_col] = df[col]
        elif best_transform[0] == 'log1p':
            if df[col].min() >= 0:
                df[transformed_col] = np.log1p(df[col])
            else:
                df[transformed_col] = np.log1p(df[col] - df[col].min())
        elif best_transform[0] == 'sqrt':
            if df[col].min() >= 0:
                df[transformed_col] = np.sqrt(df[col])
            else:
                df[transformed_col] = np.sqrt(df[col] - df[col].min())
        elif best_transform[0] == 'cbrt':
            df[transformed_col] = np.cbrt(df[col])
        elif best_transform[0] == 'square':
            df[transformed_col] = df[col] ** 2
        elif best_transform[0] == 'yeojohnson':
            df[transformed_col], _ = yeojohnson(df[col].fillna(df[col].median()))

    return df

df = transform_skew(df, features='distance_from_prev_mi')
transformed_skew = df['distance_from_prev_mi_skewfix'].skew()
print(f"✅ Question 13 Complete: Transformed skewness = {transformed_skew:.3f}")

# QUESTION 14: impute_missing
def impute_missing(df, features=None, group_cols=None):
    """Fill missing values using group-based imputation with global fallback."""
    df = df.copy()

    if features is None:
        features = df.columns[df.isnull().any()].tolist()
    elif isinstance(features, str):
        features = [features]

    if group_cols is None:
        clean_cols = [col for col in df.columns if col.endswith('_clean')]
        group_cols = [col for col in ['hub_clean', 'delivery_zone_clean',
                                       'customer_type_clean', 'weather_clean']
                     if col in clean_cols]

    for col in features:
        if col not in df.columns or df[col].isnull().sum() == 0:
            continue

        is_numeric = pd.api.types.is_numeric_dtype(df[col])

        if is_numeric:
            if group_cols and len(group_cols) > 0:
                for group_col in group_cols:
                    if group_col in df.columns:
                        group_medians = df.groupby(group_col)[col].transform('median')
                        df[col] = df[col].fillna(group_medians)
            global_median = df[col].median()
            df[col] = df[col].fillna(global_median)
        else:
            if group_cols and len(group_cols) > 0:
                for group_col in group_cols:
                    if group_col in df.columns:
                        group_modes = df.groupby(group_col)[col].transform(
                            lambda x: x.mode()[0] if not x.mode().empty else np.nan
                        )
                        df[col] = df[col].fillna(group_modes)
            if df[col].mode().size > 0:
                global_mode = df[col].mode()[0]
                df[col] = df[col].fillna(global_mode)

    return df

df = impute_missing(df)
denver_east_temp = df[df['hub_clean'] == 'denver-east']['cargo_temp_f'].mean()
print(f"✅ Question 14 Complete: Denver-East cargo temp = {denver_east_temp:.2f}°F")

# QUESTION 15: cap_outliers_iqr
def cap_outliers_iqr(df, cols=None):
    """Handle extreme values using Tukey's fence method."""
    df = df.copy()

    if cols is None:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cols = [col for col in numeric_cols if df[col].dropna().nunique() > 2]
    elif isinstance(cols, str):
        cols = [cols]

    for col in cols:
        if col not in df.columns:
            continue
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lower_fence = Q1 - 1.5 * IQR
        upper_fence = Q3 + 1.5 * IQR
        df[col] = df[col].clip(lower=lower_fence, upper=upper_fence)

    return df

df = cap_outliers_iqr(df)
max_service_time = df['service_time_min'].max()
print(f"✅ Question 15 Complete: Max service time = {max_service_time:.4f} minutes")

# QUESTION 16: Business Analysis Report
print()
print("=" * 60)
print("📊 DELIVERY PERFORMANCE ANALYSIS REPORT")
print("=" * 60)
print()

print("=" * 60)
print("📦 HUB PERFORMANCE ANALYSIS")
print("=" * 60)
hub_stats = df.groupby('hub_clean')['delivery_status_clean'].apply(
    lambda x: (x == 'delivered').sum() / len(x) * 100
).sort_values(ascending=False)
hub_df = pd.DataFrame({
    'hub_clean': hub_stats.index,
    'success_rate_pct': hub_stats.values
})
print(hub_df.to_string(index=False))
print()

print("=" * 60)
print("✅ PRIORITY LEVEL RISK ANALYSIS")
print("=" * 60)
priority_stats = df.groupby('priority_level_clean')['delivery_status_clean'].apply(
    lambda x: (x == 'failed').sum() / len(x) * 100
).sort_values(ascending=False)
priority_df = pd.DataFrame({
    'priority_level_clean': priority_stats.index,
    'failure_rate_pct': priority_stats.values
})
print(priority_df.to_string(index=False))
print()

# Visualization
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

ax1 = axes[0]
hub_df_sorted = hub_df.sort_values('success_rate_pct')
bars1 = ax1.barh(hub_df_sorted['hub_clean'], hub_df_sorted['success_rate_pct'],
                 color='steelblue')
ax1.set_xlabel('Success Rate (%)')
ax1.set_ylabel('Hub')
ax1.set_title('Delivery Success Rate by Hub', fontweight='bold', fontsize=13)
for i, bar in enumerate(bars1):
    width = bar.get_width()
    ax1.text(width, bar.get_y() + bar.get_height()/2,
            f'{width:.1f}%', ha='left', va='center', fontsize=10)

ax2 = axes[1]
priority_df_sorted = priority_df.sort_values('failure_rate_pct')
bars2 = ax2.barh(priority_df_sorted['priority_level_clean'],
                 priority_df_sorted['failure_rate_pct'], color='coral')
ax2.set_xlabel('Failure Rate (%)')
ax2.set_ylabel('Priority Level')
ax2.set_title('Delivery Failure Rate by Priority', fontweight='bold', fontsize=13)
for i, bar in enumerate(bars2):
    width = bar.get_width()
    ax2.text(width, bar.get_y() + bar.get_height()/2,
            f'{width:.1f}%', ha='left', va='center', fontsize=10)

plt.tight_layout()
plt.savefig('/Users/waylansmac/Desktop/455/delivery_analysis.png', dpi=300, bbox_inches='tight')
print("✅ Visualization saved: delivery_analysis.png")
print()

# Business Insights
print("=" * 60)
print("📊 ACTIONABLE BUSINESS INSIGHTS")
print("=" * 60)
print()

best_hub = hub_df.iloc[0]
worst_hub = hub_df.iloc[-1]
performance_gap = best_hub['success_rate_pct'] - worst_hub['success_rate_pct']

print(f"**Hub Performance Analysis:**")
print(f"  - Best performing hub: {best_hub['hub_clean']} ({best_hub['success_rate_pct']:.1f}% success rate)")
print(f"  - Worst performing hub: {worst_hub['hub_clean']} ({worst_hub['success_rate_pct']:.1f}% success rate)")
print(f"  - Performance gap: {performance_gap:.1f} percentage points")
print(f"  - RECOMMENDATION: Investigate operational differences at {worst_hub['hub_clean']}.")
print(f"    Consider implementing best practices from {best_hub['hub_clean']}.")
print()

highest_risk = priority_df.iloc[0]
lowest_risk = priority_df.iloc[-1]
risk_differential = highest_risk['failure_rate_pct'] - lowest_risk['failure_rate_pct']

print(f"**Priority Level Risk Analysis:**")
print(f"  - Highest risk priority: {highest_risk['priority_level_clean']} ({highest_risk['failure_rate_pct']:.1f}% failure rate)")
print(f"  - Lowest risk priority: {lowest_risk['priority_level_clean']} ({lowest_risk['failure_rate_pct']:.1f}% failure rate)")
print(f"  - Risk differential: {risk_differential:.1f} percentage points")
print(f"  - RECOMMENDATION: Allocate additional resources to {highest_risk['priority_level_clean']} deliveries")
print(f"    to reduce failure rates and improve customer satisfaction.")
print()

original_hub_count = df['hub'].nunique()
cleaned_hub_count = df['hub_clean'].nunique()

print(f"**Data Cleaning Impact:**")
print(f"  Before cleaning: {original_hub_count} inconsistent hub names prevented reliable analysis.")
print(f"  After cleaning: {cleaned_hub_count} standardized hubs enable actionable insights.")
print(f"  - Standardized {len(df)} delivery records across all cleaning steps")
print(f"  - Resolved missing values, outliers, and inconsistent formatting")
print(f"  - Created time-based features for temporal analysis")
print(f"  - Pipeline is reproducible and ready for production use")
print()
print("=" * 60)

best_success_rate = hub_df['success_rate_pct'].max()
print(f"\nQuestion 16 Check: Highest hub success rate: {best_success_rate:.1f}%")

# Export Cleaned Dataset
output_path = '/Users/waylansmac/Desktop/455/cleaned_delivery_data.csv'
df.to_csv(output_path, index=False)

print()
print("=" * 60)
print(f"✅ CLEANED DATASET EXPORTED")
print("=" * 60)
print(f"   File: {output_path}")
print(f"   Total rows: {len(df)}")
print(f"   Total columns: {len(df.columns)}")
print(f"   Missing values: {df.isnull().sum().sum()}")
print("=" * 60)
print()
print("🎉 Data Cleaning Pipeline Complete!")
