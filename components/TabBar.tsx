"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  matches: (path: string) => boolean;
};

const BASE_TABS: Tab[] = [
  {
    href: "/dashboard",
    label: "Atlas",
    matches: (p) => p === "/dashboard" || p.startsWith("/dashboard/"),
  },
  {
    href: "/lifting",
    label: "Lifting",
    matches: (p) => p.startsWith("/lifting") || p.startsWith("/log"),
  },
  {
    href: "/steps",
    label: "Journey",
    matches: (p) => p.startsWith("/steps"),
  },
  {
    href: "/calories",
    label: "Provisions",
    matches: (p) => p.startsWith("/calories"),
  },
  {
    href: "/history",
    label: "Battle Log",
    matches: (p) => p.startsWith("/history"),
  },
  {
    href: "/achievements",
    label: "Hall",
    matches: (p) => p.startsWith("/achievements"),
  },
];

const ADMIN_TAB: Tab = {
  href: "/admin",
  label: "Admin",
  matches: (p) => p.startsWith("/admin"),
};

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };

export default function TabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname() ?? "";
  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <>
      {/* Desktop tabs — carved stone separators */}
      <nav className="hidden md:flex items-center">
        {tabs.map((t, i) => {
          const active = t.matches(pathname);
          return (
            <div key={t.href} className="flex items-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className="h-4 w-px mx-1"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent, rgba(139,115,85,0.35), transparent)",
                  }}
                />
              )}
              <Link
                href={t.href}
                prefetch={true}
                className={`relative px-4 h-10 flex items-center text-[12px] uppercase tracking-[0.20em] font-semibold transition-colors duration-150 ${
                  active ? "text-gold" : "text-muted hover:text-ink"
                }`}
                style={{
                  ...fontDisplay,
                  textShadow: active
                    ? "0 1px 0 rgba(0,0,0,0.7)"
                    : undefined,
                }}
              >
                <span>{t.label}</span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute -bottom-px left-2 right-2"
                    style={{
                      height: 2,
                      background:
                        "linear-gradient(90deg, transparent, #b8860b 25%, #d4a020 50%, #b8860b 75%, transparent)",
                      borderRadius: 1,
                    }}
                  />
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-bronze-deep"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          backgroundColor: "#0a0a12",
          backgroundImage: "var(--noise-bg)",
          boxShadow:
            "inset 0 1px 0 rgba(0,0,0,0.5), 0 -8px 24px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div className="flex">
          {tabs.map((t) => {
            const active = t.matches(pathname);
            return (
              <Link
                key={t.href}
                href={t.href}
                prefetch={true}
                className={`flex-1 flex items-center justify-center px-1 py-3 text-[10px] uppercase tracking-[0.16em] font-semibold transition-colors duration-150 relative ${
                  active ? "text-gold" : "text-muted"
                }`}
                style={{ ...fontDisplay, minHeight: 52 }}
              >
                <span>{t.label}</span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2"
                    style={{
                      width: 28,
                      height: 2,
                      background:
                        "linear-gradient(90deg, transparent, #b8860b, transparent)",
                      borderRadius: 1,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
