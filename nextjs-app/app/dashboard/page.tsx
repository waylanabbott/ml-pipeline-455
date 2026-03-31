import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const cid = cookieStore.get("customer_id")?.value;
  if (!cid) redirect("/select-customer?msg=please-select");

  const customerId = Number(cid);

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("customer_id", customerId)
    .single();

  const { data: orderRows } = await supabase
    .from("orders")
    .select("order_total, is_fraud")
    .eq("customer_id", customerId);

  const totalOrders = orderRows?.length || 0;
  const totalSpent = orderRows?.reduce((s, o) => s + o.order_total, 0) || 0;
  const avgOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;
  const fraudCount = orderRows?.filter((o) => o.is_fraud === 1).length || 0;

  const { data: recentOrders } = await supabase
    .from("orders")
    .select(`
      order_id, order_datetime, order_total, payment_method, risk_score, is_fraud,
      order_predictions(fraud_probability)
    `)
    .eq("customer_id", customerId)
    .order("order_datetime", { ascending: false })
    .limit(10);

  return (
    <>
      <h1 style={{ marginBottom: "0.5rem" }}>Dashboard</h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
        {customer?.full_name} &mdash; {customer?.customer_segment} / {customer?.loyalty_tier}
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="value">{totalOrders}</div>
          <div className="label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="value">${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="label">Total Spent</div>
        </div>
        <div className="stat-card">
          <div className="value">${avgOrder.toFixed(2)}</div>
          <div className="label">Avg Order</div>
        </div>
        <div className="stat-card">
          <div className="value" style={{ color: fraudCount > 0 ? "#dc2626" : "#16a34a" }}>
            {fraudCount}
          </div>
          <div className="label">Fraud Orders</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: "1rem" }}>Recent Orders</h2>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Risk Score</th>
              <th>ML Fraud Prob</th>
              <th>Actual</th>
            </tr>
          </thead>
          <tbody>
            {(recentOrders || []).map((o: Record<string, unknown>) => {
              const prediction = Array.isArray(o.order_predictions) ? o.order_predictions[0] : o.order_predictions;
              const prob = prediction?.fraud_probability as number | undefined;

              return (
                <tr key={o.order_id as number}>
                  <td><a href={`/orders/${o.order_id}`}>#{o.order_id as number}</a></td>
                  <td>{(o.order_datetime as string).slice(0, 10)}</td>
                  <td>${(o.order_total as number).toFixed(2)}</td>
                  <td>{o.payment_method as string}</td>
                  <td>{(o.risk_score as number).toFixed(1)}</td>
                  <td>
                    {prob != null ? (
                      <>
                        {(prob * 100).toFixed(1)}%
                        <div className="prob-bar" style={{ width: 80, marginTop: 4 }}>
                          <div className="fill" style={{
                            width: `${prob * 100}%`,
                            background: prob > 0.5 ? "#dc2626" : prob > 0.3 ? "#d97706" : "#16a34a",
                          }} />
                        </div>
                      </>
                    ) : <span style={{ color: "#9ca3af" }}>Not scored</span>}
                  </td>
                  <td>
                    {(o.is_fraud as number) === 1
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
