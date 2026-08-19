import Link from "next/link";
import AtsResultStamp from "@/components/ats-result-stamp";
import { ticketCompletion } from "@/lib/ticket-completion";
import SurvivorPokerChip from "@/components/survivor-poker-chip";

export type TicketPick = {
  gameId: string;
  team: string;
  kickoff: string;
  spread: string | null;
  lineLocked: boolean;
  resultMark?: "W" | "L" | "";
};

type SurvivorTicket = {
  abbreviation: string;
  team: string;
  kickoff: string;
  resultMark?: "W" | "L" | "";
} | null;

type Props = {
  isPlayoff?: boolean;
  maxPicks: number;
  picks: TicketPick[];
  readOnly?: boolean;
  survivorAvailable: boolean;
  survivorPick: SurvivorTicket;
  survivorStatus: "active" | "eliminated" | "complete";
  week: string;
};

export default function MyTicket({
  isPlayoff = false,
  maxPicks,
  picks,
  survivorAvailable,
  survivorPick,
  survivorStatus,
  week,
}: Props) {
  const { isFilled, requiredSelections: totalRequiredSelections, selectionsMade: totalSelections } = ticketCompletion({
    isPlayoff,
    maxPicks,
    pickemSelections: picks.length,
    survivorAvailable,
    survivorPickMade: Boolean(survivorPick),
    survivorStatus,
  });
  const status = isFilled ? "SUBMITTED" : "OPEN";

  return (
    <section className="my-ticket" aria-label={`Your current ticket for ${week}`} id="my-ticket">
      {survivorPick ? (
        <span className="my-ticket-survivor-chip" aria-label={`Survivor selection: ${survivorPick.team}`}>
          <SurvivorPokerChip
            abbreviation={survivorPick.abbreviation}
            size="ticket"
            teamName={survivorPick.team}
          />
        </span>
      ) : null}
      <div className="my-ticket-brand">
        <p>JOE BARR MEMORIAL</p>
        <h1>LEAD PIPE LOCKS</h1>
      </div>

      <div className="my-ticket-race">
        <strong>{week}</strong>
        <span>TICKET</span>
      </div>

      <div className={`my-ticket-columns ${isPlayoff ? "is-playoff" : ""}`}>
        <div className={`my-ticket-section ${isPlayoff ? "my-ticket-playoff" : ""}`}>
          <div className="my-ticket-section-heading">
            <Link className="my-ticket-section-link" href="/board">{isPlayoff ? "PLAYOFF ATS" : "PICK'EM ATS"}</Link>
            <strong>{isPlayoff ? "ROUND LINES" : "OFFICIAL LINES"}</strong>
          </div>
          <ol className="my-ticket-picks">
            {Array.from({ length: maxPicks }, (_, index) => {
              const pick = picks[index];
              return (
                <li key={pick?.gameId ?? `open-${index}`}>
                  {pick ? (
                    <>
                      <span className="my-ticket-selection">
                        <strong>{pick.team}<AtsResultStamp className="ml-1" result={pick.resultMark} /></strong>
                        <small>{pick.kickoff}</small>
                      </span>
                      <span className={`my-ticket-line ${pick.lineLocked ? "is-locked" : ""}`}>
                        {pick.lineLocked && pick.spread ? pick.spread : "—"}
                      </span>
                    </>
                  ) : (
                    <span className="my-ticket-open">OPEN</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {!isPlayoff ? <div className="my-ticket-section my-ticket-survivor">
          <div className="my-ticket-section-heading">
            <Link className="my-ticket-section-link" href="/board#slate-matchups">SURVIVOR WINNER</Link>
            <strong>STRAIGHT-UP</strong>
          </div>
          {survivorPick ? (
            <div className="my-ticket-survivor-pick">
              <div>
                <small>OFFICIAL SELECTION</small>
                <strong>{survivorPick.team}<AtsResultStamp className="ml-1" result={survivorPick.resultMark} /></strong>
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
            <p>Official spreads appear on Ticket once final.</p>
            <p>Selections are revealed to others at kickoff.</p>
            <p>Only winners count; pushes and ties are losers.</p>
          </div>
        </div> : null}
      </div>

      <div className="my-ticket-footer">
        <span className={`my-ticket-completion ${isFilled ? "is-filled" : "is-open"}`}>
          <span className="my-ticket-change-note">Selections can be changed prior to kickoff</span>
          <span>{totalSelections}/{totalRequiredSelections} SELECTIONS MADE</span>
        </span>
        <div>
          <small>TICKET STATUS</small>
          <strong className={isFilled ? "is-filled" : "is-open"}>{status}</strong>
        </div>
        <i aria-hidden="true" className="my-ticket-barcode" />
      </div>
    </section>
  );
}
