import "./globals.css";
import { cookies } from "next/headers";
import { supabase } from "@/lib/db";

export const metadata = { title: "Fraud Detection Pipeline" };

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
          <span className="brand">Fraud Detection Pipeline</span>
          <a href="/select-customer">Customers</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/place-order">Place Order</a>
          <a href="/orders">Orders</a>
          <a href="/warehouse/priority">Fraud Queue</a>
          <a href="/scoring">Run Scoring</a>
          {customerName && (
            <span style={{ marginLeft: "auto", color: "#93c5fd", fontSize: "0.85rem" }}>
              Logged in as: {customerName}
            </span>
          )}
        </nav>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
