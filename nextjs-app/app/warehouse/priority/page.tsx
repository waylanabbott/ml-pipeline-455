import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WarehousePriority() {
  const { data: predictions } = await supabase
    .from("delivery_predictions")
    .select("order_id, late_probability, predicted_late")
    .order("late_probability", { ascending: false })
    .limit(50);

  const orderIds = (predictions || []).map((p) => p.order_id);

  const { data: orderData } = await supabase
    .from("orders")
    .select("order_id, order_total, order_datetime, payment_method, customer_id, customers(full_name)")
    .in("order_id", orderIds);

  const { data: shipmentData } = await supabase
    .from("shipments")
    .select("order_id, carrier, shipping_method, distance_band, promised_days, actual_days, late_delivery")
    .in("order_id", orderIds);

  const orderMap = new Map((orderData || []).map((o) => [o.order_id, o]));
  const shipMap = new Map((shipmentData || []).map((s) => [s.order_id, s]));

  const combined = (predictions || []).map((p) => ({
    ...p,
    order: orderMap.get(p.order_id),
    shipment: shipMap.get(p.order_id),
  }));

  return (
    <>
      <h1 style={{ marginBottom: "0.5rem" }}>Late Delivery Priority Queue</h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
        Top 50 orders ranked by ML-predicted late delivery probability
      </p>

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Carrier</th>
              <th>Method</th>
              <th>Distance</th>
              <th>Promised</th>
              <th>ML Late Prob</th>
              <th>Actual</th>
            </tr>
          </thead>
          <tbody>
            {combined.map((row, i) => {
              const prob = row.late_probability;
              const cust = Array.isArray(row.order?.customers) ? row.order.customers[0] : row.order?.customers;
              return (
                <tr key={row.order_id}>
                  <td>{i + 1}</td>
                  <td><a href={`/orders/${row.order_id}`}>#{row.order_id}</a></td>
                  <td>{cust?.full_name || "—"}</td>
                  <td>${row.order?.order_total?.toFixed(2) || "—"}</td>
                  <td>{row.shipment?.carrier || "—"}</td>
                  <td>{row.shipment?.shipping_method || "—"}</td>
                  <td>{row.shipment?.distance_band || "—"}</td>
                  <td>{row.shipment?.promised_days || "—"}d</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: prob > 0.7 ? "#dc2626" : prob > 0.5 ? "#d97706" : "#16a34a" }}>
                        {(prob * 100).toFixed(1)}%
                      </span>
                      <div className="prob-bar" style={{ width: 80 }}>
                        <div className="fill" style={{
                          width: `${prob * 100}%`,
                          background: prob > 0.7 ? "#dc2626" : prob > 0.5 ? "#d97706" : "#16a34a",
                        }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    {row.shipment?.late_delivery === 1
                      ? <span className="badge badge-danger">LATE</span>
                      : <span className="badge badge-success">ON TIME</span>}
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
