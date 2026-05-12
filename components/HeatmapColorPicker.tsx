"use client";

import { useEffect, useRef, useState } from "react";
import {
  generateMonochromeScale,
  isValidHex,
  normalizeHex,
  PRESET_COLORS,
} from "@/lib/heatmap-color";
import { useHeatmapPalette } from "@/components/HeatmapColorContext";

export default function HeatmapColorPicker({
  size = 24,
}: {
  size?: number;
}) {
  const { base, setBase } = useHeatmapPalette();
  const [open, setOpen] = useState(false);
  const [customHex, setCustomHex] = useState(base);
  const popRef = useRef<HTMLDivElement | null>(null);

  // Keep custom hex in sync when palette changes externally (storage event).
  useEffect(() => setCustomHex(base), [base]);

  // Outside click + Esc to close
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function applyCustom() {
    if (isValidHex(customHex)) setBase(normalizeHex(customHex));
  }

  return (
    <div className="relative inline-flex" ref={popRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Change heatmap color"
        aria-label="Change heatmap color"
        aria-expanded={open}
        className="rounded-full transition hover:brightness-110 active:translate-y-px"
        style={{
          width: size,
          height: size,
          background: base,
          border: "1px solid rgba(184,134,11,0.55)",
          boxShadow: `0 0 6px ${base}aa, inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(0,0,0,0.40)`,
          padding: 0,
        }}
      />
      {open && (
        <div
          className="absolute z-30 rounded-md p-3"
          style={{
            top: size + 8,
            right: 0,
            width: 200,
            background: "var(--noise-bg), #0c0a14",
            border: "1px solid rgba(107,79,58,0.55)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 32px rgba(0,0,0,0.7)",
          }}
          role="dialog"
          aria-label="Pick a heatmap color"
        >
          <div
            className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              color: "#d4a020",
            }}
          >
            Heatmap Color
          </div>
          {/* Each swatch shows the actual light→dark ramp for that
              hue so the user can see the full range, not a single tone. */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PRESET_COLORS.map((p) => {
              const active = normalizeHex(base) === normalizeHex(p.hex);
              const s = generateMonochromeScale(p.hex);
              const ramp = `linear-gradient(135deg, ${s.untrained} 0%, ${s.below} 20%, ${s.average} 40%, ${s.above} 60%, ${s.exceptional} 80%, ${s.elite} 100%)`;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setBase(p.hex);
                    setOpen(false);
                  }}
                  title={p.label}
                  aria-label={p.label}
                  className="rounded-full transition hover:brightness-110"
                  style={{
                    width: 32,
                    height: 32,
                    background: ramp,
                    border: active
                      ? "2px solid #f5efe2"
                      : "1px solid rgba(0,0,0,0.5)",
                    boxShadow: active
                      ? `0 0 10px ${s.elite}, inset 0 1px 0 rgba(255,255,255,0.20)`
                      : `0 0 4px ${s.elite}66, inset 0 1px 0 rgba(255,255,255,0.12)`,
                    padding: 0,
                  }}
                />
              );
            })}
          </div>
          <div
            className="text-[9px] uppercase tracking-[0.18em] mb-1.5 font-bold"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              color: "rgba(216,210,194,0.65)",
            }}
          >
            Custom Hex
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyCustom();
                  setOpen(false);
                }
              }}
              placeholder="#a855f7"
              className="flex-1 text-[12px] tabular-nums"
              style={{
                minHeight: 28,
                padding: "4px 8px",
                fontFamily: "ui-monospace, monospace",
              }}
              maxLength={7}
              aria-label="Custom hex color"
            />
            <button
              type="button"
              onClick={() => {
                applyCustom();
                setOpen(false);
              }}
              disabled={!isValidHex(customHex)}
              className="text-[10px] uppercase tracking-[0.18em] py-1 px-3 rounded font-bold transition hover:brightness-110 disabled:opacity-40"
              style={{
                fontFamily: "var(--font-cinzel), Georgia, serif",
                color: "#f5efe2",
                background: "linear-gradient(180deg, #7747b0, #3a2466)",
                border: "1px solid #7747b0",
              }}
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
