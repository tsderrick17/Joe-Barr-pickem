"use client";

import Link from "next/link";
import { memo, type CSSProperties } from "react";
import { HapticTap } from "@/components/haptic-tap";
import { haptic } from "@/lib/haptics-client";
import SurvivorPokerChip from "@/components/survivor-poker-chip";

export type ReceiptTeam = {
  gameId: string;
  name: string;
  abbreviation: string;
  lineValue: string | null;
  isLineLocked: boolean;
  canRemove: boolean;
  isSaved: boolean;
};

type Props = {
  isLoading: boolean;
  isSubmitting: boolean;
  periodType: "regular" | "playoff" | undefined;
  selectionLimit: number;
  selectedTeams: ReceiptTeam[];
  selectedPickCount: number;
  pickemHasUnsavedChanges: boolean;
  survivor: {
    show: boolean;
    controlsEnabled: boolean;
    hasUnsavedChanges: boolean;
    hasPick: boolean;
    teamName: string;
    status: "active" | "eliminated" | "complete";
    details: { name: string; abbreviation: string } | null;
  };
  selectionWarning: string;
  /** The picks are full and the player tapped another team: which open pick should it replace? */
  swapPrompt?: { newTeam: string; options: Array<{ gameId: string; label: string }> } | null;
  onSwap?: (gameId: string) => void;
  onCancelSwap?: () => void;
  onSubmit: () => void;
  onRemove: (gameId: string) => void;
};

/**
 * The Slate's sticky receipt: the stub with Submit, the Pick'em selections,
 * and (during the regular season) the Survivor pick. It owns the receipt's
 * wording and status rules; the page hands it plain facts.
 */
function SlateReceipt({ isLoading, isSubmitting, periodType, selectionLimit, selectedTeams, selectedPickCount, pickemHasUnsavedChanges, survivor, selectionWarning, swapPrompt = null, onSwap, onCancelSwap, onSubmit, onRemove }: Props) {
  const hasUnsavedChanges = pickemHasUnsavedChanges || survivor.hasUnsavedChanges;
  const survivorReceipt = survivor.teamName || (survivor.status === "complete" ? "COMPLETE" : survivor.status === "eliminated" ? "OUT" : "OPEN");
  // Saved selections arrive asynchronously. Keep the receipt neutral until
  // they do so, rather than briefly presenting an incorrect OPEN ticket.
  const receiptIsLoading = isLoading;
  // The receipt stays calm once it matches the saved record. Its sheen and
  // tactile click are reserved for a new selection or a change to a saved one.
  const receiptNeedsSaving = !receiptIsLoading && hasUnsavedChanges;
  const pickemReceiptStatus = receiptIsLoading
    ? "CHECKING"
    : pickemHasUnsavedChanges
      ? "CHANGED"
      : selectedPickCount === selectionLimit
        ? "FILLED"
        : "OPEN";
  const survivorReceiptStatus = receiptIsLoading
    ? "CHECKING"
    : survivor.hasUnsavedChanges
      ? "CHANGED"
      : survivorReceipt === "OPEN"
        ? "OPEN"
        : survivorReceipt === "OUT" || survivorReceipt === "COMPLETE"
          ? survivorReceipt
          : "FILLED";
  const receiptStatusLabel = (status: string) => {
    if (status === "FILLED") return "SUBMITTED";
    if (status === "CHANGED") return "CHANGED";
    return status;
  };
  const sealedPickCount = selectedTeams.filter((team) => !team.canRemove).length;
  const openPickCount = selectedTeams.length - sealedPickCount;
  const duePickCount = Math.max(selectionLimit - selectedTeams.length, 0);
  const pickemReceiptStateDetail = [
    sealedPickCount > 0 ? `${sealedPickCount} SEALED` : "",
    openPickCount > 0 && sealedPickCount > 0 ? `${openPickCount} OPEN` : "",
    duePickCount > 0 ? `${duePickCount} DUE` : "",
  ].filter(Boolean).join(" · ");
  const submitHint = receiptIsLoading
    ? "CHECKING SAVED PICKS"
    : isSubmitting
      ? "SAVING PICKS"
      : receiptNeedsSaving
        ? "READY TO SAVE"
        : duePickCount > 0
          ? `${duePickCount} PICK${duePickCount === 1 ? "" : "S"} NEEDED`
          : survivor.controlsEnabled && !survivor.hasPick
            ? "SURVIVOR PICK NEEDED"
            : "PICKS SAVED";

  return (
    <section
      aria-label="Your weekly receipt"
      className={`slate-mini-nav slate-receipt-strip ${survivor.show ? "has-survivor" : "is-pickem-only"} ${periodType === "playoff" ? "is-playoff" : ""} ${sealedPickCount > 0 && openPickCount > 0 ? "has-mixed-locks" : ""} ${receiptIsLoading ? "receipt-is-loading" : ""}`}
    >
      <div className="slate-receipt-ticket">
        <span>YOUR RECEIPT</span>
        <div className="slate-receipt-actions">
          <Link href="/#my-ticket"><span className="receipt-link-lead">VIEW </span>FULL TICKET</Link>
          <button
            className={`slate-receipt-print ${receiptNeedsSaving ? "needs-attention" : ""}`}
            disabled={receiptIsLoading || isSubmitting}
            onClick={() => { haptic("tick"); onSubmit(); }}
            type="button"
          >
            SUBMIT
            <HapticTap />
          </button>
        </div>
        <span className="slate-receipt-footnote">
          <span
            aria-live="polite"
            className={`receipt-printing-status ${isSubmitting ? "is-printing" : ""}`}
            role="status"
          >
            <span aria-hidden="true" className="receipt-printing-marks"><i /><i /><i /></span>
            <span>{isSubmitting ? "PRINTING" : ""}</span>
          </span>
          <span aria-live="polite" className="slate-receipt-submit-hint">{submitHint}</span>
        </span>
      </div>
      <div className="slate-receipt-pool slate-receipt-pickem">
        <span>PICK&apos;EM</span>
        <div className={`slate-receipt-selection-chips slate-receipt-selection-chips--${periodType === "playoff" ? "playoff" : "regular"} slate-receipt-selection-chips--slots-${Math.min(selectionLimit, 6)}`} style={{ "--selection-slot-count": Math.min(selectionLimit, 6) } as CSSProperties}>
          {receiptIsLoading ? <strong className="is-quiet">CHECKING</strong> : selectedTeams.length ? selectedTeams.map((team, index) => (
            <span
              className={`selection-chip slate-receipt-selection-chip ${team.isSaved ? "is-saved" : "is-draft"} ${team.canRemove ? "is-editable" : "is-sealed"}`}
              key={team.gameId}
              title={team.abbreviation}
            >
              <span>{index + 1}. {team.abbreviation}{team.lineValue ? <small className={team.isLineLocked ? "is-official" : ""}> {team.lineValue}</small> : null}</span>
              {team.canRemove ? <button aria-label={`Remove ${team.name}`} onClick={() => onRemove(team.gameId)} type="button">×</button> : <span aria-label="Sealed at kickoff" className="slate-receipt-lock-mark" role="img">🔒</span>}
            </span>
          )) : <strong className="is-due">PICK DUE</strong>}
        </div>
        <em className={pickemReceiptStatus === "CHANGED" ? "is-unsaved" : pickemReceiptStatus === "FILLED" ? "is-complete" : ""}>{receiptIsLoading ? "CHECKING" : <>{selectedPickCount}/{selectionLimit} · {receiptStatusLabel(pickemReceiptStatus)}{pickemReceiptStateDetail ? <small> · {pickemReceiptStateDetail}</small> : null}</>}</em>
      </div>
      {survivor.show ? (
        <div className="slate-receipt-pool slate-receipt-survivor">
          <span>SURVIVOR</span>
          <div aria-label={!receiptIsLoading && survivor.details ? survivor.details.name : undefined} className={`slate-receipt-survivor-pick ${survivor.hasUnsavedChanges && survivor.controlsEnabled ? "is-awaiting-lock" : ""}`} role={!receiptIsLoading && survivor.details ? "img" : undefined}>
            {!receiptIsLoading && survivor.details ? <SurvivorPokerChip abbreviation={survivor.details.abbreviation} size="summary" teamName={survivor.details.name} tooltip={survivor.details.name} /> : <strong className={survivorReceiptStatus === "OPEN" ? "is-due" : survivorReceiptStatus === "OUT" ? "is-out" : "is-quiet"}>{receiptIsLoading ? "CHECKING" : survivorReceipt}</strong>}
          </div>
          <em className={survivorReceiptStatus === "CHANGED" ? "is-unsaved" : survivorReceiptStatus === "FILLED" ? "is-complete" : ""}>{receiptIsLoading ? "CHECKING" : receiptStatusLabel(survivorReceiptStatus)}</em>
        </div>
      ) : null}
      {swapPrompt ? (
        <div className="slate-receipt-warning slate-receipt-swap" role="alert">
          <span className="slate-receipt-swap-eyebrow">PICKS ARE FULL</span>
          <button className="slate-receipt-swap-cancel" onClick={() => onCancelSwap?.()} type="button">Cancel</button>
          <p>Replace which one with {swapPrompt.newTeam}?</p>
          <div className="slate-receipt-swap-actions">
            {swapPrompt.options.map((option) => <button className="slate-receipt-selection-chip slate-receipt-swap-choice" key={option.gameId} onClick={() => onSwap?.(option.gameId)} type="button">Replace {option.label}</button>)}
          </div>
        </div>
      ) : selectionWarning ? <p className="slate-receipt-warning" role="alert">{selectionWarning}</p> : null}
    </section>
  );
}

export default memo(SlateReceipt);
