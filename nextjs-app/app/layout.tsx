import "./globals.css";
import { cookies } from "next/headers";
import { supabase } from "@/lib/db";

export const metadata = { title: "Shop ML Pipeline" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let customerName = "";
  const cookieStore = await cookies();
  const cid = cookieStore.get("customer_id")?.value;
  if (cid) {
    const { data } = await supabase
      .from("customers")
      .select("full_name")
      .eq("customer_id", Number(cid))
      .single();
    if (data) customerName = data.full_name;
  }

  return (
    <html lang="en">
      <body>
        <nav>
          <span className="brand">Shop ML Pipeline</span>
          <a href="/select-customer">Customers</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/place-order">Place Order</a>
          <a href="/orders">Orders</a>
          <a href="/warehouse/priority">Warehouse</a>
          <a href="/scoring">Run Scoring</a>
          {customerName ? (
            <span style={{ marginLeft: "auto", color: "#93c5fd", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              Viewing data for: {customerName}
              <a href="/api/select-customer/clear" style={{ color: "#bfdbfe" }}>Clear selection</a>
            </span>
          ) : (
            <span style={{ marginLeft: "auto", color: "#cbd5e1", fontSize: "0.85rem" }}>No customer selected</span>
          )}
        </nav>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
