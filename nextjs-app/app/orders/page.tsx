import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const cookieStore = await cookies();
  const cid = cookieStore.get("customer_id")?.value;
  if (!cid) redirect("/select-customer");

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      order_id, order_datetime, order_total, payment_method, device_type, ip_country,
      shipments(carrier, shipping_method, late_delivery),
      delivery_predictions(late_probability, predicted_late)
    `)
    .eq("customer_id", Number(cid))
    .order("order_datetime", { ascending: false });

  return (
    <>
      <h1 style={{ marginBottom: "1rem" }}>Order History</h1>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Carrier</th>
              <th>Method</th>
              <th>ML Late Prob</th>
              <th>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {(orders || []).map((o: Record<string, unknown>) => {
              const shipment = Array.isArray(o.shipments) ? o.shipments[0] : o.shipments;
              const prediction = Array.isArray(o.delivery_predictions) ? o.delivery_predictions[0] : o.delivery_predictions;

              return (
                <tr key={o.order_id as number}>
                  <td><a href={`/orders/${o.order_id}`}>#{o.order_id as number}</a></td>
                  <td>{(o.order_datetime as string).slice(0, 10)}</td>
                  <td>${(o.order_total as number).toFixed(2)}</td>
                  <td>{o.payment_method as string}</td>
                  <td>{(shipment?.carrier as string) || "—"}</td>
                  <td>{(shipment?.shipping_method as string) || "—"}</td>
                  <td>
                    {prediction?.late_probability != null
                      ? `${((prediction.late_probability as number) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td>
                    {shipment?.late_delivery != null ? (
                      (shipment.late_delivery as number) === 1
                        ? <span className="badge badge-danger">LATE</span>
                        : <span className="badge badge-success">ON TIME</span>
                    ) : <span style={{ color: "#9ca3af" }}>Pending</span>}
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
