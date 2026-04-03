import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

function buildOrderId(base?: number) {
  // Use epoch seconds to avoid the misaligned Postgres sequence that was
  // causing duplicate primary-key errors. Bump by 1 on retries if needed.
  const seed = Math.floor(Date.now() / 1000);
  return base != null ? base : seed;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cid = body.customer_id ?? req.cookies.get("customer_id")?.value;
  if (cid == null) {
    return NextResponse.json({ error: "Please choose a customer before submitting an order." }, { status: 400 });
  }

  const customerId = Number(cid);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
  }

  const { items, payment_method, device_type } = body;
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

  // Insert order with a resilient primary key to avoid the duplicate-key errors
  // coming from the existing SERIAL sequence.
  let orderId = buildOrderId();
  let orderErr;
  let order;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("orders")
      .insert({
        order_id: orderId,
        customer_id: customerId,
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

    order = data;
    orderErr = error;
    if (!orderErr) break;
    // If the sequence is still off, bump the id and retry a couple times.
    if (orderErr?.message?.includes("duplicate key value violates unique constraint")) {
      orderId += 1;
      continue;
    }
    break;
  }

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
