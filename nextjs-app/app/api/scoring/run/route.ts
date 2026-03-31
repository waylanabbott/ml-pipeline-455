import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST() {
  const { count: totalOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });

  const { count: scoredOrders } = await supabase
    .from("order_predictions")
    .select("*", { count: "exact", head: true });

  const unscored = (totalOrders || 0) - (scoredOrders || 0);

  if (unscored > 0) {
    return NextResponse.json({
      output: `${scoredOrders} of ${totalOrders} orders scored for fraud. ${unscored} unscored orders remain — run 'python3 jobs/run_inference.py' locally to score new orders.`,
    });
  }

  return NextResponse.json({
    output: `All ${totalOrders} orders have been scored for fraud. ${scoredOrders} predictions in the order_predictions table. View the fraud queue for results.`,
  });
}
