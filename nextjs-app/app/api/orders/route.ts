import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(req: NextRequest) {
  const cid = req.cookies.get("customer_id")?.value;
  if (!cid) {
    return NextResponse.json({ error: "No customer selected" }, { status: 401 });
  }

  const { items, payment_method, device_type } = await req.json();
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const subtotal = items.reduce(
    (s: number, i: { unit_price: number; quantity: number }) => s + i.unit_price * i.quantity,
    0
  );
  const shippingFee = subtotal > 100 ? 0 : 9.99;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal + shippingFee + tax) * 100) / 100;

  const now = new Date().toISOString();

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      customer_id: Number(cid),
      order_datetime: now,
      billing_zip: "00000",
      shipping_zip: "00000",
      shipping_state: "XX",
      payment_method,
      device_type,
      ip_country: "US",
      promo_used: 0,
      promo_code: null,
      order_subtotal: subtotal,
      shipping_fee: shippingFee,
      tax_amount: tax,
      order_total: total,
      risk_score: 0,
      is_fraud: 0,
    })
    .select("order_id")
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: orderErr?.message || "Failed to create order" }, { status: 500 });
  }

  // Insert order items
  const orderItems = items.map((i: { product_id: number; quantity: number; unit_price: number }) => ({
    order_id: order.order_id,
    product_id: i.product_id,
    quantity: i.quantity,
    unit_price: i.unit_price,
    line_total: Math.round(i.unit_price * i.quantity * 100) / 100,
  }));

  await supabase.from("order_items").insert(orderItems);

  // Insert placeholder shipment
  await supabase.from("shipments").insert({
    order_id: order.order_id,
    ship_datetime: now,
    carrier: "UPS",
    shipping_method: "standard",
    distance_band: "regional",
    promised_days: 5,
    actual_days: 0,
    late_delivery: 0,
  });

  return NextResponse.json({ order_id: order.order_id });
}
