"use client";

/**
 * A choice made by tapping the thing itself, in place of a drop-down menu: every option is a chip in view, the chosen one filled in.
 * Screen readers hear a group of toggle buttons with the chosen one pressed.
 */
export function ChoiceChips<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string;
  value: T | "";
  options: Array<{ value: T; label: string; note?: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return <div aria-label={label} className="cw-choices" role="group">
    {options.map((option) => <button aria-pressed={value === option.value} disabled={disabled} key={option.value} onClick={() => onChange(option.value)} type="button">
      <span>{option.label}</span>
      {option.note ? <small>{option.note}</small> : null}
    </button>)}
  </div>;
}

/** Steps through a list one at a time (a week, a period) with arrows either side of the current one, in place of a drop-down. */
export function Stepper({ label, items, value, onChange, disabled = false }: {
  label: string;
  items: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const index = Math.max(0, items.findIndex((item) => item.value === value));
  const go = (step: number) => { const next = items[index + step]; if (next) onChange(next.value); };
  return <div aria-label={label} className="cw-stepper" role="group">
    <button aria-label={`Previous: ${items[index - 1]?.label ?? "none"}`} disabled={disabled || index === 0} onClick={() => go(-1)} type="button">‹</button>
    <b aria-live="polite">{items[index]?.label ?? "—"}</b>
    <button aria-label={`Next: ${items[index + 1]?.label ?? "none"}`} disabled={disabled || index >= items.length - 1} onClick={() => go(1)} type="button">›</button>
  </div>;
}
