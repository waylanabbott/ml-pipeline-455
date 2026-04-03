import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/select-customer", req.url));
  res.cookies.delete("customer_id", { path: "/" });
  return res;
}

export async function POST(req: NextRequest) {
  // Allow POST as well for easy form/button wiring.
  return GET(req);
}
