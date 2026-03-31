import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase
    .from("customers")
    .select("customer_id, full_name, email, customer_segment, loyalty_tier, city, state")
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
