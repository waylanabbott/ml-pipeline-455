import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { customer_id } = await req.json();
  const res = NextResponse.json({ ok: true });
  res.cookies.set("customer_id", String(customer_id), {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
