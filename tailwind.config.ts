import type { Config } from "tailwindcss";

/**
 * Theme tokens are CSS variables (set in globals.css under `:root` for
 * Dark Fantasy and `.light-fantasy` for Light Fantasy). The `<alpha-value>`
 * placeholder is replaced by Tailwind so that opacity modifiers keep
 * working — e.g. `bg-bg/40`, `text-ink/80`.
 */
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Theme-driven surfaces / text ──────────────────────
        bg: v("--color-bg"),
        panel: v("--color-panel"),
        elevated: v("--color-elevated"),
        border: v("--color-border"),
        "border-bright": v("--color-border-bright"),
        hover: v("--color-elevated"),
        ink: v("--color-ink"),
        "ink-strong": v("--color-ink-strong"),
        "ink-muted": v("--color-ink-muted"),
        muted: v("--color-muted"),
        accent: v("--color-accent"),
        "accent-soft": v("--color-accent-soft"),
        "accent-glow": "rgba(109, 40, 217, 0.18)",
        gold: v("--color-gold"),
        "gold-soft": v("--color-gold-soft"),
        "gold-glow": "rgba(184, 134, 11, 0.18)",
        bronze: v("--color-bronze"),
        "bronze-deep": v("--color-bronze-deep"),

        // ── Tier / status colors — same in both themes ────────
        mana: "#3a5a8a",
        "mana-glow": "rgba(58, 90, 138, 0.18)",
        nature: "#3d6b3a",
        "nature-glow": "rgba(61, 107, 58, 0.18)",
        ember: "#a0432a",
        danger: "#a83232",

        strength: {
          dormant: "#4a4a52",
          awakened: "#3a5a8a",
          trained: "#3d6b3a",
          powerful: "#b8860b",
          mighty: "#a0432a",
          legendary: "#5b3993",
        },

        pastel: {
          purple: "#7c3aed",
          pink: "#a83232",
          blue: "#3a5a8a",
          green: "#3d6b3a",
          yellow: "#b8860b",
          orange: "#a0432a",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "var(--font-cinzel)",
          "Cinzel",
          "Georgia",
          "serif",
        ],
      },
      letterSpacing: {
        widest: "0.22em",
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      boxShadow: {
        soft:
          "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.5)",
        "soft-lg":
          "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.6)",
        accent:
          "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 14px rgba(40,20,60,0.6)",
        gold: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 14px rgba(40,30,10,0.6)",
        legendary:
          "inset 0 0 0 1px rgba(91,57,147,0.5), 0 0 18px rgba(91,57,147,0.25)",
      },
      transitionTimingFunction: {
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
