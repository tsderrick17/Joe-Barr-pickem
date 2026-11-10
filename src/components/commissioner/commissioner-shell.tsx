"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SPOKES, spokeIndexForPath } from "@/lib/commissioner-wheel.js";
import { haptic } from "@/lib/haptics-client";
import { HapticTap } from "@/components/haptic-tap";
import { CommissionerStatusProvider, useCommissionerStatus } from "@/components/commissioner/commissioner-status";
import { Medallion, Sheet, type SpokeState } from "@/components/commissioner/wheel-parts";
import { WheelIcon } from "@/components/commissioner/wheel-icons";
import CommissionerDial from "@/components/commissioner/commissioner-dial";

const GameDayPlaybook = dynamic(() => import("@/components/game-day-playbook"));
const CommissionerHandbook = dynamic(() => import("@/components/commissioner-handbook"));

/** The page's title: its medallion, its name with the felt underline, and one line on what it holds. Focus lands here on arrival. */
function PageHead({ index }: { index: number }) {
  const spoke = SPOKES[index];
  const { spokes } = useCommissionerStatus();
  const status = spokes[spoke.key] as { state: SpokeState; count: number; line?: string };
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    document.title = `${spoke.name} · Commissioner`;
  }, [spoke.name]);
  return <div className="cw-page-head">
    <span className="cw-badge"><Medallion icon={spoke.icon} state={status.state} /></span>
    <div>
      <h1 ref={heading} tabIndex={-1}>{spoke.name}</h1>
      <p>{status.line ?? spoke.line}</p>
    </div>
  </div>;
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const index = spokeIndexForPath(pathname);
  const [handbookOpen, setHandbookOpen] = useState(false);

  useEffect(() => { if (index < 0) document.title = "Commissioner"; }, [index]);

  return <div className={`cw-shell ${index >= 0 ? "has-dial" : ""}`}>
    <header className="cw-top">
      <div className="cw-top-in">
        <div><small>Commissioner</small><b>Operations</b></div>
        <button className="cw-handbook" onClick={() => { haptic("tick"); setHandbookOpen(true); }} type="button">
          <WheelIcon name="book" />Handbook
          <HapticTap />
        </button>
      </div>
    </header>
    <main className="cw-main">
      {index >= 0 ? <PageHead index={index} key={index} /> : null}
      {children}
    </main>
    {index >= 0 ? <CommissionerDial current={index} /> : null}
    <Sheet onClose={() => setHandbookOpen(false)} open={handbookOpen} title="Handbook">
      <div className="cw-handbook-body">
        <GameDayPlaybook />
        <CommissionerHandbook />
      </div>
    </Sheet>
  </div>;
}

/**
 * Every Commissioner page sits inside this: the bar with the Handbook, the page's title, and the dial along the bottom.
 * The Workshop is the exception: it fills the whole screen with its own controls.
 */
export default function CommissionerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/workshop")) return <>{children}</>;
  return <CommissionerStatusProvider><Shell>{children}</Shell></CommissionerStatusProvider>;
}
