import type { ReactNode } from "react";

/**
 * The foot of a ticket's list: its send or save button. While there are changes to send it is pinned to the bottom of the ticket
 * (sticky), with how many changes are waiting beside the button, so the button is in reach wherever the list is scrolled; with
 * nothing to send it rests at the end of the list, where it says the ticket is sent or saved.
 */
export function SaveBar({ changes, pinned, children, prompt = null }: { changes: number; pinned: boolean; children: ReactNode; prompt?: ReactNode }) {
  return (
    <div className={`lab-savebar${pinned ? " is-pinned" : ""}`}>
      {prompt}
      {pinned && changes > 0 ? <span className="lab-savebar-count">{changes} {changes === 1 ? "change" : "changes"}</span> : null}
      {children}
    </div>
  );
}
