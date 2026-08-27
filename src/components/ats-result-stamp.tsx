export type AtsResultMark = string | null | undefined;

/**
 * The single visual receipt for a settled against-the-spread result.
 * Keep this shared anywhere the pool records a W or L so final views stay
 * auditable and visually identical.
 */
export default function AtsResultStamp({ result, className = "", tilted = true, variant = "mark" }: { result: AtsResultMark; className?: string; tilted?: boolean; variant?: "mark" | "ticket" }) {
  const mark = result === "win" ? "W" : result === "loss" ? "L" : result;
  if (mark !== "W" && mark !== "L") return null;

  const label = `Against the spread: ${mark === "W" ? "win" : "loss"}`;

  if (variant === "ticket") {
    return (
      <strong
        aria-label={label}
        className={`ats-result-stamp ats-result-stamp--ticket relative inline-flex shrink-0 items-center justify-center ${mark === "W" ? "text-green-700" : "text-red-700"} ${className}`}
      >
        {mark}
      </strong>
    );
  }

  return (
    <strong
      aria-label={label}
      className={`ats-result-stamp relative -top-0.5 inline-block shrink-0 ${tilted ? "-rotate-[7deg]" : ""} text-sm font-black leading-none ${mark === "W" ? "text-green-700" : "text-red-700"} ${className}`}
    >
      {mark}
    </strong>
  );
}
