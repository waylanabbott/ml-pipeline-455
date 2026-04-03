"use client";

import { useState, useEffect } from "react";

interface Product {
  product_id: number;
  product_name: string;
  category: string;
  price: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Customer {
  customer_id: number;
  full_name: string;
}

export default function PlaceOrder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [deviceType] = useState("desktop");
  const [status, setStatus] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
    ]).then(([productList, customerList]) => {
      setProducts(productList);
      setCustomers(customerList);
      if (customerList.length > 0) setCustomerId(customerList[0].customer_id);
    });
  }, []);

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.product_id === p.product_id);
      if (existing) {
        return prev.map((i) =>
          i.product.product_id === p.product_id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  }

  function removeFromCart(pid: number) {
    setCart((prev) => prev.filter((i) => i.product.product_id !== pid));
  }

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);

  async function submitOrder() {
    if (cart.length === 0) return;
    if (!customerId) {
      setStatus("Please pick a customer before submitting.");
      return;
    }
    setStatus("Submitting...");
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        items: cart.map((i) => ({
          product_id: i.product.product_id,
          quantity: i.quantity,
          unit_price: i.product.price,
        })),
        payment_method: paymentMethod,
        device_type: deviceType,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus(`Order #${data.order_id} created!`);
      setCart([]);
    } else {
      setStatus(`Error: ${data.error}`);
    }
  }

  return (
    <>
      <h1 style={{ marginBottom: "1rem" }}>Place Order</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "1.5rem" }}>
        <div className="card" style={{ overflowX: "auto" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>Products</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.product_id}>
                  <td>{p.product_name}</td>
                  <td>{p.category}</td>
                  <td>${p.price.toFixed(2)}</td>
                  <td>
                    <button className="btn btn-primary" onClick={() => addToCart(p)}>
                      Add
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="card">
            <h2 style={{ marginBottom: "0.75rem" }}>Cart</h2>
            {cart.length === 0 ? (
              <p style={{ color: "#9ca3af" }}>Empty</p>
            ) : (
              <>
                {cart.map((i) => (
                  <div
                    key={i.product.product_id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.4rem 0",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <span>
                      {i.product.product_name} x{i.quantity}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      ${(i.product.price * i.quantity).toFixed(2)}
                      <button
                        onClick={() => removeFromCart(i.product.product_id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          cursor: "pointer",
                        }}
                      >
                        x
                      </button>
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: "0.75rem", fontWeight: 700 }}>
                  Subtotal: ${subtotal.toFixed(2)}
                </div>
              </>
            )}
          </div>

          <div className="card">
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
              Customer
            </label>
            <select value={customerId ?? ""} onChange={(e) => setCustomerId(Number(e.target.value))}>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.full_name} (#{c.customer_id})
                </option>
              ))}
            </select>

            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
              Payment Method
            </label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="card">Card</option>
              <option value="paypal">PayPal</option>
              <option value="bank">Bank</option>
              <option value="crypto">Crypto</option>
            </select>

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "1rem" }}
              onClick={submitOrder}
              disabled={cart.length === 0}
            >
              Submit Order
            </button>

            {status && (
              <p style={{ marginTop: "0.75rem", fontWeight: 600, color: status.includes("Error") ? "#dc2626" : "#16a34a" }}>
                {status}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
