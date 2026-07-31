import SurvivorPokerChip from "@/components/survivor-poker-chip";

export type TicketPick = {
  gameId: string;
  team: string;
  kickoff: string;
  spread: string | null;
  lineLocked: boolean;
};

type SurvivorTicket = {
  abbreviation: string;
  team: string;
} | null;

type Props = {
  hasUnsavedChanges: boolean;
  maxPicks: number;
  picks: TicketPick[];
  readOnly: boolean;
  survivorAvailable: boolean;
  survivorPick: SurvivorTicket;
  survivorStatus: "active" | "eliminated" | "complete";
  week: string;
};

function ticketStatus({
  hasUnsavedChanges,
  pickemDue,
  readOnly,
  survivorDue,
}: {
  hasUnsavedChanges: boolean;
  pickemDue: number;
  readOnly: boolean;
  survivorDue: boolean;
}) {
  if (readOnly) return "FINAL RECEIPT";
  if (hasUnsavedChanges) return "UNSAVED CHANGES";
  if (pickemDue > 0 || survivorDue) return "ACTION DUE";
  return "TICKET COMPLETE";
}

export default function MyTicket({
  hasUnsavedChanges,
  maxPicks,
  picks,
  readOnly,
  survivorAvailable,
  survivorPick,
  survivorStatus,
  week,
}: Props) {
  const pickemDue = Math.max(0, maxPicks - picks.length);
  const survivorDue =
    survivorAvailable &&
    survivorStatus === "active" &&
    !survivorPick;
  const status = ticketStatus({
    hasUnsavedChanges,
    pickemDue,
    readOnly,
    survivorDue,
  });

  return (
    <section className="my-ticket mt-5" aria-label={`My ticket for ${week}`}>
      <div className="my-ticket-brand">
        <p>JOE BARR MEMORIAL</p>
        <h2>Saratoga</h2>
        <span>MY TICKET · LEAD PIPE LOCKS</span>
      </div>

      <p className="my-ticket-serial">
        JB-{week.replace(/\s+/g, "-").toUpperCase()}-{String(maxPicks).padStart(2, "0")}P
      </p>

      <div className="my-ticket-race">
        <strong>{week}</strong>
        <span>THE SLATE</span>
      </div>

      <div className="my-ticket-rule">
        <span>{maxPicks} PICK ATS CARD</span>
        <strong>{picks.length} BET{picks.length === 1 ? "" : "S"}</strong>
      </div>

      <div className="my-ticket-columns">
        <div className="my-ticket-section">
          <div className="my-ticket-section-heading">
            <span>PICK&apos;EM</span>
            <strong>{picks.length}/{maxPicks} FILED</strong>
          </div>
          <ol className="my-ticket-picks">
            {Array.from({ length: maxPicks }, (_, index) => {
              const pick = picks[index];
              return (
                <li key={pick?.gameId ?? `open-${index}`}>
                  <span className="my-ticket-number">{String(index + 1).padStart(2, "0")}</span>
                  {pick ? (
                    <>
                      <span className="my-ticket-selection">
                        <strong>{pick.team}</strong>
                        <small>{pick.kickoff}</small>
                      </span>
                      <span className={`my-ticket-line ${pick.lineLocked ? "is-locked" : ""}`}>
                        {pick.lineLocked && pick.spread ? pick.spread : "PENDING"}
                      </span>
                    </>
                  ) : (
                    <span className="my-ticket-open">OPEN SELECTION</span>
                  )}
                </li>
              );
            })}
          </ol>
          {pickemDue > 0 && !readOnly ? (
            <p className="my-ticket-due">{pickemDue} PICK{pickemDue === 1 ? "" : "S"} STILL DUE</p>
          ) : null}
        </div>

        <div className="my-ticket-section my-ticket-survivor">
          <div className="my-ticket-section-heading">
            <span>SURVIVOR</span>
            <strong>STRAIGHT-UP</strong>
          </div>
          {survivorPick ? (
            <div className="my-ticket-survivor-pick">
              <SurvivorPokerChip
                abbreviation={survivorPick.abbreviation}
                official
                size="summary"
                teamName={survivorPick.team}
              />
              <div>
                <small>OFFICIAL SELECTION</small>
                <strong>{survivorPick.team}</strong>
              </div>
            </div>
          ) : survivorStatus === "eliminated" ? (
            <p className="my-ticket-survivor-state is-out">ENTRY CLOSED · OUT</p>
          ) : survivorStatus === "complete" ? (
            <p className="my-ticket-survivor-state">POOL COMPLETE</p>
          ) : survivorAvailable ? (
            <p className="my-ticket-survivor-state">ONE PICK DUE</p>
          ) : (
            <p className="my-ticket-survivor-state">NOT AVAILABLE</p>
          )}
        </div>
      </div>

      <div className="my-ticket-footer">
        <span>{picks.length + (survivorPick ? 1 : 0)} BETS</span>
        <div>
          <small>TICKET STATUS</small>
          <strong className={status === "ACTION DUE" || status === "UNSAVED CHANGES" ? "needs-action" : ""}>{status}</strong>
          <small>{readOnly ? "PERMANENT WEEKLY RECEIPT" : "EDITABLE UNTIL EACH LISTED KICKOFF"}</small>
        </div>
        <i aria-hidden="true" className="my-ticket-barcode" />
      </div>
    </section>
  );
}
