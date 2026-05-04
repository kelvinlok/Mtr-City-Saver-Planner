import { useT } from "../domain/i18n";
import type { TripPriority } from "../domain/types";

type PriorityToggleProps = {
  value: TripPriority;
  ariaLabel: string;
  onChange: (priority: TripPriority) => void;
};

const options: { value: TripPriority; labelKey: string; shortKey: string }[] = [
  { value: "definitely",    labelKey: "priority.definitely",    shortKey: "priority.definitelyShort" },
  { value: "maybe",         labelKey: "priority.maybe",         shortKey: "priority.maybeShort" },
  { value: "not_preferred", labelKey: "priority.notPreferred",  shortKey: "priority.notPreferredShort" },
];

export function PriorityToggle({ value, ariaLabel, onChange }: PriorityToggleProps) {
  const t = useT();

  return (
    <div className="priority-toggle" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`priority-btn priority-btn--${opt.value} ${value === opt.value ? "priority-btn--active" : ""}`}
          aria-pressed={value === opt.value}
          title={t(opt.labelKey)}
          onClick={() => onChange(opt.value)}
        >
          <span className="priority-btn-short" aria-hidden="true">{t(opt.shortKey)}</span>
          <span className="priority-btn-label">{t(opt.labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
