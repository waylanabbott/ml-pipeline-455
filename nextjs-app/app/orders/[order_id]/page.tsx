import { supabase } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OrderDetail({ params }: { params: Promise<{ order_id: string }> }) {
  const { order_id } = await params;

  const { data: order } = await supabase
    .from("orders")
    .select(`
      *, customers(full_name, customer_segment, loyalty_tier),
      order_predictions(fraud_probability, predicted_fraud, scored_at)
    `)
    .eq("order_id", Number(order_id))
    .single();

  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("*, products(product_name, category)")
    .eq("order_id", Number(order_id));

  const { data: shipment } = await supabase
    .from("shipments")
    .select("*")
    .eq("order_id", Number(order_id))
    .single();

  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const prediction = Array.isArray(order.order_predictions) ? order.order_predictions[0] : order.order_predictions;
  const fraudProb = prediction?.fraud_probability as number | null;

  return (
    <>
      <h1 style={{ marginBottom: "0.5rem" }}>Order #{order_id}</h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
        {customer?.full_name} &mdash; {(order.order_datetime as string).slice(0, 10)}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card">
          <h3 style={{ marginBottom: "0.5rem" }}>Order Info</h3>
          <p>Payment: {order.payment_method}</p>
          <p>Device: {order.device_type}</p>
          <p>IP Country: {order.ip_country}</p>
          <p>Promo: {order.promo_used ? `Yes (${order.promo_code})` : "No"}</p>
          <p>Subtotal: ${order.order_subtotal.toFixed(2)}</p>
          <p>Shipping: ${order.shipping_fee.toFixed(2)}</p>
          <p>Tax: ${order.tax_amount.toFixed(2)}</p>
          <p>Total: <strong>${order.order_total.toFixed(2)}</strong></p>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: "0.5rem" }}>Fraud Analysis</h3>
          <p>Risk Score: <strong>{order.risk_score.toFixed(1)}</strong></p>
          <p>
            Actual:{" "}
            {order.is_fraud === 1
              ? <span className="badge badge-danger">FRAUD</span>
              : <span className="badge badge-success">OK</span>}
          </p>
          <hr style={{ margin: "0.75rem 0", border: "none", borderTop: "1px solid #e5e7eb" }} />
          {fraudProb != null ? (
            <>
              <p>ML Fraud Probability: <strong>{(fraudProb * 100).toFixed(1)}%</strong></p>
              <div className="prob-bar" style={{ width: "100%", marginTop: 8 }}>
                <div className="fill" style={{
                  width: `${fraudProb * 100}%`,
                  background: fraudProb > 0.5 ? "#dc2626" : fraudProb > 0.3 ? "#d97706" : "#16a34a",
                }} />
              </div>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: 4 }}>
                Scored: {prediction?.scored_at}
              </p>
            </>
          ) : <p style={{ color: "#9ca3af" }}>Not yet scored by ML model</p>}
        </div>
      </div>

      {shipment && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginBottom: "0.5rem" }}>Shipment</h3>
          <p>Carrier: {shipment.carrier} | Method: {shipment.shipping_method} | Distance: {shipment.distance_band}</p>
          <p>
            Promised: {shipment.promised_days}d | Actual: {shipment.actual_days}d
            {shipment.late_delivery === 1 && <span className="badge badge-warning" style={{ marginLeft: 8 }}>LATE</span>}
          </p>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: "0.5rem" }}>Line Items</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map((item: Record<string, unknown>) => {
              const product = Array.isArray(item.products) ? item.products[0] : item.products;
              return (
                <tr key={item.order_item_id as number}>
                  <td>{product?.product_name as string}</td>
                  <td>{product?.category as string}</td>
                  <td>{item.quantity as number}</td>
                  <td>${(item.unit_price as number).toFixed(2)}</td>
                  <td>${(item.line_total as number).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
