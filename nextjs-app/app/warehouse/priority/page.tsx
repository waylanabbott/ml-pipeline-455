import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FraudQueue() {
  const { data: predictions } = await supabase
    .from("order_predictions")
    .select("order_id, fraud_probability, predicted_fraud")
    .order("fraud_probability", { ascending: false })
    .limit(50);

  const orderIds = (predictions || []).map((p) => p.order_id);

  const { data: orderData } = await supabase
    .from("orders")
    .select("order_id, order_total, order_datetime, payment_method, device_type, ip_country, risk_score, is_fraud, customer_id, customers(full_name)")
    .in("order_id", orderIds);

  const orderMap = new Map((orderData || []).map((o) => [o.order_id, o]));

  const combined = (predictions || []).map((p) => ({
    ...p,
    order: orderMap.get(p.order_id),
  }));

  return (
    <>
      <h1 style={{ marginBottom: "0.5rem" }}>Fraud Priority Queue</h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
        Top 50 orders ranked by ML-predicted fraud probability
      </p>

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Device</th>
              <th>IP</th>
              <th>Risk Score</th>
              <th>ML Fraud Prob</th>
              <th>Actual</th>
            </tr>
          </thead>
          <tbody>
            {combined.map((row, i) => {
              const prob = row.fraud_probability;
              const cust = Array.isArray(row.order?.customers) ? row.order.customers[0] : row.order?.customers;
              return (
                <tr key={row.order_id}>
                  <td>{i + 1}</td>
                  <td><a href={`/orders/${row.order_id}`}>#{row.order_id}</a></td>
                  <td>{cust?.full_name || "—"}</td>
                  <td>${row.order?.order_total?.toFixed(2) || "—"}</td>
                  <td>{row.order?.payment_method || "—"}</td>
                  <td>{row.order?.device_type || "—"}</td>
                  <td>{row.order?.ip_country || "—"}</td>
                  <td>{row.order?.risk_score?.toFixed(1) || "—"}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: prob > 0.5 ? "#dc2626" : prob > 0.3 ? "#d97706" : "#16a34a" }}>
                        {(prob * 100).toFixed(1)}%
                      </span>
                      <div className="prob-bar" style={{ width: 80 }}>
                        <div className="fill" style={{
                          width: `${prob * 100}%`,
                          background: prob > 0.5 ? "#dc2626" : prob > 0.3 ? "#d97706" : "#16a34a",
                        }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    {row.order?.is_fraud === 1
                      ? <span className="badge badge-danger">FRAUD</span>
                      : <span className="badge badge-success">OK</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
