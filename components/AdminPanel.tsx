"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader, { type HeaderProfile } from "@/components/AppHeader";

type UserRow = {
  id: string;
  username: string | null;
  role: string;
  email: string | null;
};

type Props = {
  users: UserRow[];
  currentUserId: string;
  username: string;
  profile?: HeaderProfile;
};

export default function AdminPanel({
  users,
  currentUserId,
  username,
  profile,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
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
      body: JSON.stringify({ email, username: newUsername, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "Failed");
      return;
    }
    setMsg("Created.");
    setEmail("");
    setNewUsername("");
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
    <div className="min-h-screen flex flex-col bg-bg pb-24 md:pb-0">
      <AppHeader username={username} isAdmin={true} profile={profile} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 lg:px-8 py-10 grid lg:grid-cols-2 gap-6">
        <section className="bg-panel border border-border rounded-2xl p-6">
          <h2 className="text-[10px] font-medium text-muted uppercase tracking-[0.2em] mb-4">
            Create User
          </h2>
          <form onSubmit={createUser} className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
                Password
              </label>
              <input
                type="text"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            {err && <p className="text-sm text-red-400">{err}</p>}
            {msg && <p className="text-sm text-green-400">{msg}</p>}
            <button
              type="submit"
              disabled={busy}
              className="btn-stone w-full"
            >
              {busy ? "Creating…" : "Create User"}
            </button>
          </form>
        </section>

        <section className="bg-panel border border-border rounded-2xl p-6">
          <h2 className="text-[10px] font-medium text-muted uppercase tracking-[0.2em] mb-4">
            Users ({users.length})
          </h2>
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li
                key={u.id}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {u.username ?? "—"}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {u.email ?? u.id}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg border border-border capitalize">
                    {u.role}
                  </span>
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition"
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
