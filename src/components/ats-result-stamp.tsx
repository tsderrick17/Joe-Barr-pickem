export type AtsResultMark = string | null | undefined;

/**
 * The single visual receipt for a settled against-the-spread result.
 * Keep this shared anywhere the pool records a W or L so final views stay
 * auditable and visually identical.
 */
export default function AtsResultStamp({ result, className = "", tilted = true, variant = "mark" }: { result: AtsResultMark; className?: string; tilted?: boolean; variant?: "mark" | "ticket" }) {
  const mark = result === "win" ? "W" : result === "loss" ? "L" : result;
  if (mark !== "W" && mark !== "L") return null;

  return (
    <strong
      aria-label={`Against the spread: ${mark === "W" ? "win" : "loss"}`}
      data-mark={variant === "ticket" ? mark : undefined}
      className={`ats-result-stamp relative -top-0.5 inline-block shrink-0 ${variant === "ticket" ? "ats-result-stamp--ticket" : ""} ${tilted ? "-rotate-[7deg]" : ""} text-sm font-black leading-none ${mark === "W" ? "text-green-700" : "text-red-700"} ${className}`}
    >
      {mark}
    </strong>
  );
}
