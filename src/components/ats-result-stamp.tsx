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
    const wearPath = mark === "W"
      ? "M9.6 13.1l4 .35m7.1-2.7 3.2.3m-11.6 9.6 3.5.25m4.4 3 3.2.25"
      : "M12.5 11.8l3.4.3m-3.1 6.2 3.2.2m-.7 5.2 5.1.35";

    return (
      <strong
        aria-label={label}
        className={`ats-result-stamp ats-result-stamp--ticket relative inline-flex shrink-0 ${mark === "W" ? "text-green-700" : "text-red-700"} ${className}`}
      >
        <svg aria-hidden="true" className="ats-result-stamp__art" viewBox="0 0 34 34">
          <path
            className="ats-result-stamp__ring"
            d="M17.2 2.5C25.6 2.3 31.5 8.2 31.6 16.7C31.8 25.3 25.4 31.6 16.9 31.4C8.5 31.3 2.3 25.2 2.5 16.9C2.7 8.6 8.9 2.7 17.2 2.5Z"
          />
          <text
            className={`ats-result-stamp__letter is-${mark.toLowerCase()}`}
            textAnchor="middle"
            x="17"
            y="24.2"
          >
            {mark}
          </text>
          <path className="ats-result-stamp__wear" d={wearPath} />
        </svg>
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
