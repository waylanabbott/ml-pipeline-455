import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST() {
  const { count: totalOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });

  const { count: scoredOrders } = await supabase
    .from("delivery_predictions")
    .select("*", { count: "exact", head: true });

  const unscored = (totalOrders || 0) - (scoredOrders || 0);

  if (unscored > 0) {
    return NextResponse.json({
      output: `${scoredOrders} of ${totalOrders} orders scored. ${unscored} unscored orders — run 'python3 jobs/run_delivery_inference.py' locally to score new orders, then re-import to Supabase.`,
    });
  }

  return NextResponse.json({
    output: `All ${totalOrders} orders have been scored. ${scoredOrders} delivery predictions in the database. View the priority queue for results.`,
  });
}
