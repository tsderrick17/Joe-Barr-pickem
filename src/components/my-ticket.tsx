import Link from "next/link";
import { ticketCompletion } from "@/lib/ticket-completion";

export type TicketPick = {
  gameId: string;
  team: string;
  kickoff: string;
  spread: string | null;
  lineLocked: boolean;
  resultMark?: "W" | "L" | "";
};

type SurvivorTicket = {
  team: string;
  kickoff: string;
  resultMark?: "W" | "L" | "";
} | null;

type Props = {
  maxPicks: number;
  picks: TicketPick[];
  readOnly?: boolean;
  survivorAvailable: boolean;
  survivorPick: SurvivorTicket;
  survivorStatus: "active" | "eliminated" | "complete";
  week: string;
};

function ResultStamp({ result }: { result?: "W" | "L" | "" }) {
  if (!result) return null;
  return <span className={`my-ticket-result is-${result.toLowerCase()}`}>{result}</span>;
}

export default function MyTicket({
  maxPicks,
  picks,
  survivorAvailable,
  survivorPick,
  survivorStatus,
  week,
}: Props) {
  const { isFilled, requiredSelections: totalRequiredSelections, selectionsMade: totalSelections } = ticketCompletion({
    maxPicks,
    pickemSelections: picks.length,
    survivorAvailable,
    survivorPickMade: Boolean(survivorPick),
    survivorStatus,
  });
  const status = isFilled ? "FILLED" : "OPEN";

  return (
    <section className="my-ticket" aria-label={`Your current ticket for ${week}`}>
      <div className="my-ticket-brand">
        <p>JOE BARR MEMORIAL</p>
        <h1>LEAD PIPE LOCKS</h1>
      </div>

      <div className="my-ticket-race">
        <strong>{week}</strong>
        <span>TICKET</span>
      </div>

      <div className="my-ticket-columns">
        <div className="my-ticket-section">
          <div className="my-ticket-section-heading">
            <Link className="my-ticket-section-link" href="/board">PICK&apos;EM ATS</Link>
            <strong>OFFICIAL LINES</strong>
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
                        <strong>{pick.team}<ResultStamp result={pick.resultMark} /></strong>
                        <small>{pick.kickoff}</small>
                      </span>
                      <span className={`my-ticket-line ${pick.lineLocked ? "is-locked" : ""}`}>
                        {pick.lineLocked && pick.spread ? pick.spread : "—"}
                      </span>
                    </>
                  ) : (
                    <span className="my-ticket-open">OPEN SELECTION</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="my-ticket-section my-ticket-survivor">
          <div className="my-ticket-section-heading">
            <Link className="my-ticket-section-link" href="/survivor">SURVIVOR WINNER</Link>
            <strong>STRAIGHT-UP</strong>
          </div>
          {survivorPick ? (
            <div className="my-ticket-survivor-pick">
              <div>
                <small>OFFICIAL SELECTION</small>
                <strong>{survivorPick.team}<ResultStamp result={survivorPick.resultMark} /></strong>
                <small>{survivorPick.kickoff}</small>
              </div>
            </div>
          ) : survivorStatus === "eliminated" ? (
            <p className="my-ticket-survivor-state">ENTRY CLOSED &middot; OUT</p>
          ) : survivorStatus === "complete" ? (
            <p className="my-ticket-survivor-state">POOL COMPLETE</p>
          ) : survivorAvailable ? (
            <p className="my-ticket-survivor-state">ONE PICK DUE</p>
          ) : (
            <p className="my-ticket-survivor-state">NOT AVAILABLE</p>
          )}
          <div className="my-ticket-instructions">
            <p>Official ATS spreads appear here once locked.</p>
            <p>Selections are revealed to others at kickoff.</p>
          </div>
        </div>
      </div>

      <div className="my-ticket-footer">
        <span className={`my-ticket-completion ${isFilled ? "is-filled" : "is-open"}`}>
          {totalSelections}/{totalRequiredSelections} SELECTIONS MADE
        </span>
        <div>
          <small>TICKET STATUS</small>
          <strong className={isFilled ? "is-filled" : "is-open"}>{status}</strong>
          <small className="my-ticket-footer-note">May be changed prior to kickoff.</small>
        </div>
        <i aria-hidden="true" className="my-ticket-barcode" />
      </div>
    </section>
  );
}
