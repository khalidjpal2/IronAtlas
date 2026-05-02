"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type UserRow = {
  id: string;
  username: string | null;
  role: string;
  email: string | null;
};

export default function AdminPanel({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "Failed");
      return;
    }
    setMsg("Created.");
    setEmail("");
    setUsername("");
    setPassword("");
    router.refresh();
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user permanently?")) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to delete");
      return;
    }
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          <span>Iron</span>
          <span className="text-strength-elite">Atlas</span>
          <span className="ml-2 text-xs text-muted uppercase tracking-wide">Admin</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-muted hover:text-white">
          Back to dashboard
        </Link>
      </header>

      <main className="flex-1 grid lg:grid-cols-2 gap-6 px-6 py-8 max-w-6xl mx-auto w-full">
        <section className="bg-panel border border-border rounded-xl p-6">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">
            Create User
          </h2>
          <form onSubmit={createUser} className="space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-strength-elite"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-strength-elite"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted mb-1">Password</label>
              <input
                type="text"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-strength-elite"
              />
            </div>
            {err && <p className="text-sm text-red-400">{err}</p>}
            {msg && <p className="text-sm text-strength-average">{msg}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-strength-elite hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-md transition"
            >
              {busy ? "Creating..." : "Create User"}
            </button>
          </form>
        </section>

        <section className="bg-panel border border-border rounded-xl p-6">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">
            Users ({users.length})
          </h2>
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{u.username ?? "—"}</div>
                  <div className="text-xs text-muted truncate">{u.email ?? u.id}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded bg-bg border border-border capitalize">
                    {u.role}
                  </span>
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
