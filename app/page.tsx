"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">
            <span className="text-white">Iron</span>
            <span className="text-strength-elite">Atlas</span>
          </h1>
          <p className="mt-2 text-sm text-muted">Map every muscle. Track every lift.</p>
        </div>
        <form onSubmit={onSubmit} className="bg-panel border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-muted mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-strength-elite"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-muted mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-strength-elite"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-strength-elite hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-md transition"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <p className="text-xs text-muted text-center pt-2">
            Accounts are created by an administrator.
          </p>
        </form>
      </div>
    </main>
  );
}
