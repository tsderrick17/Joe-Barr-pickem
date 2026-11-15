"use client";

import { BigBoardRoom } from "@/components/lab/lab-tote";

/**
 * Lab try-out: the tote board, the owner's favourite of the Pad skins, as the clubhouse's main piece.
 *  - The Big Board: everyone's picks in one place (today's Pad: wins, player, Pick 1, Pick 2; no place), Survivor's chips in their
 *    own column, and the season standings one tap away on the same board.
 *  - Your own row is your ticket: tap it and the ticket opens over the board, two picks against the spread and the Survivor team as
 *    plain rows, one Submit. There is no separate screen for picking.
 * Sample players only; another player's pick stays covered (dark lamps, a green IN) until its game kicks off.
 */
export function LabToteBoard() {
  return <section aria-label="Tote board try-out" className="lab-tote-room"><BigBoardRoom /></section>;
}
