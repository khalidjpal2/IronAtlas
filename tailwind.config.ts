import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        panel: "#141414",
        border: "#262626",
        muted: "#9ca3af",
        strength: {
          untrained: "#6b7280",
          below: "#3b82f6",
          average: "#22c55e",
          above: "#eab308",
          exceptional: "#f97316",
          elite: "#a855f7",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
