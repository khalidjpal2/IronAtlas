import { LEVEL_COLOR, LEVEL_LABEL, type StrengthLevel } from "@/lib/strength";

const ORDER: StrengthLevel[] = ["untrained", "below", "average", "above", "exceptional", "elite"];

export default function Legend() {
  return (
    <div className="flex flex-wrap gap-3 justify-center text-xs text-muted">
      {ORDER.map((lvl) => (
        <div key={lvl} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: LEVEL_COLOR[lvl] }}
          />
          <span>{LEVEL_LABEL[lvl]}</span>
        </div>
      ))}
    </div>
  );
}
