import { LEVEL_COLOR, LEVEL_LABEL, type StrengthLevel } from "@/lib/strength";

const ORDER: StrengthLevel[] = [
  "untrained",
  "below",
  "average",
  "above",
  "exceptional",
  "elite",
];

export default function Legend() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2 bg-elevated border border-bronze-deep rounded text-[10px] uppercase tracking-[0.16em]"
      style={{
        fontFamily: "var(--font-cinzel), Georgia, serif",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)",
      }}
    >
      {ORDER.map((lvl) => (
        <div key={lvl} className="flex items-center gap-1.5">
          <span
            className="seal"
            style={{
              width: 9,
              height: 9,
              background: LEVEL_COLOR[lvl],
            }}
          />
          <span style={{ color: LEVEL_COLOR[lvl] }}>{LEVEL_LABEL[lvl]}</span>
        </div>
      ))}
    </div>
  );
}
