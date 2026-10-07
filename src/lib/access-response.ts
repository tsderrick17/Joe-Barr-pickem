import { NextResponse } from "next/server";
import { playerAccessErrorMessage } from "@/lib/player-access-result";

/** The refusal for a failed authentication result: its status, a plain message, and the stable code. */
export function accessDenied(access: { status: number; code: string }) {
  return NextResponse.json({ error: playerAccessErrorMessage(access.code), code: access.code }, { status: access.status });
}
