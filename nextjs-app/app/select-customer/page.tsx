"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface Customer {
  customer_id: number;
  full_name: string;
  email: string;
  customer_segment: string;
  loyalty_tier: string;
  city: string;
  state: string;
}

export default function SelectCustomer() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const showPrompt = searchParams.get("msg") === "please-select";

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then(setCustomers);
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  async function select(id: number) {
    await fetch("/api/select-customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: id }),
    });
    window.location.href = "/dashboard";
  }

  return (
    <>
      {showPrompt && (
        <div style={{
          background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8,
          padding: "0.75rem 1rem", marginBottom: "1rem", color: "#92400e", fontWeight: 500,
        }}>
          Please select a customer before continuing.
        </div>
      )}
      <h1 style={{ marginBottom: "1rem" }}>Select Customer</h1>
      <input
        className="search-box"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Segment</th>
              <th>Loyalty</th>
              <th>Location</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.customer_id}>
                <td>{c.customer_id}</td>
                <td>{c.full_name}</td>
                <td>{c.email}</td>
                <td>{c.customer_segment}</td>
                <td>{c.loyalty_tier}</td>
                <td>
                  {c.city}, {c.state}
                </td>
                <td>
                  <button className="btn btn-primary" onClick={() => select(c.customer_id)}>
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
