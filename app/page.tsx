"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };

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
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* aged stone vignette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(40, 30, 50, 0.6), transparent 65%), radial-gradient(ellipse 70% 60% at 50% 95%, rgba(20, 12, 8, 0.6), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-10 text-center">
          <div
            className="text-[10px] uppercase tracking-[0.36em] text-gold/70 mb-3"
            style={fontDisplay}
          >
            Forge of
          </div>
          <h1
            className="font-bold tracking-tight gradient-text"
            style={{
              ...fontDisplay,
              fontSize: 56,
            }}
          >
            IronAtlas
          </h1>
          <p
            className="mt-4 text-xs uppercase tracking-[0.22em] text-muted"
            style={fontDisplay}
          >
            Forge your character. Train every muscle.
          </p>
          <div className="rune-divider mt-6" />
        </div>

        <form
          onSubmit={onSubmit}
          className="tablet rounded p-7 space-y-5"
        ><span className="corner-bl" /><span className="corner-br" />
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.22em] text-gold/80 mb-2 font-bold"
              style={fontDisplay}
            >
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.22em] text-gold/80 mb-2 font-bold"
              style={fontDisplay}
            >
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-stone w-full"
          >
            {loading ? "Entering..." : "Enter the Realm"}
          </button>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted text-center pt-2">
            Accounts are forged by an administrator.
          </p>
        </form>
      </div>
    </main>
  );
}
