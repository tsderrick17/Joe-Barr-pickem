"use client";

import { useState, type ReactNode } from "react";
import AtsResultStamp from "@/components/ats-result-stamp";
import { BowlCrest, BowlPennant } from "@/components/bowl-pool-marks";
import BowlScoreTile from "@/components/bowl-score-tile";
import ChipPlayground from "@/components/chip-playground";
import FootballLoader from "@/components/football-loader";
import SeasonClosedBanner from "@/components/season-closed-banner";
import SurvivorPokerChip from "@/components/survivor-poker-chip";

/**
 * Every custom piece of the pool in one place, live: the real components with sample data, so a change to any of
 * them shows here too. Nothing on this page reads or writes pool data.
 */
function AssetCard({ title, note, children, replay, dark = false, wide = false }: { title: string; note: string; children: ReactNode; replay?: () => void; dark?: boolean; wide?: boolean }) {
  return (
    <article className={`asset-card ${wide ? "is-wide" : ""}`}>
      <div>
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
      <div className={`asset-stage ${dark ? "is-dark" : ""}`}>{children}</div>
      {replay ? <button className="asset-replay" onClick={replay} type="button">Replay</button> : null}
    </article>
  );
}

const OREGON = { full_name: "Oregon Ducks", short_name: "Oregon", abbreviation: "ORE", primary_color: "154733", secondary_color: "fee123" };
const TROY = { full_name: "Troy Trojans", short_name: "Troy", abbreviation: "TROY", primary_color: "8a2432", secondary_color: "b1b3b3" };
const MARSHALL = { full_name: "Marshall Thundering Herd", short_name: "Marshall", abbreviation: "MRSH", primary_color: "00b140", secondary_color: "ffffff" };

export default function CommissionerAssets() {
  // Bumping a key remounts a demo, which restarts its animation from the beginning.
  const [keys, setKeys] = useState({ submit: 0, highlight: 0, pennant: 0, tile: 0, chip: 0 });
  const replay = (name: keyof typeof keys) => () => setKeys((current) => ({ ...current, [name]: current[name] + 1 }));

  return (
    <section aria-labelledby="commissioner-assets-title" className="commissioner-panel">
      <div className="pickem-ledger-masthead">
        <h2 id="commissioner-assets-title">Assets</h2>
      </div>
      <div className="commissioner-assets">
        <AssetCard note="The receipt's Submit button. While picks are unsaved a sheen sweeps across it and it presses itself, every 15 seconds on the Slate (every 4 here)." replay={replay("submit")} title="Submit button">
          <div className="asset-submit slate-receipt-ticket" key={keys.submit}>
            <button className="slate-receipt-print needs-attention" type="button">SUBMIT</button>
          </div>
        </AssetCard>

        <AssetCard note="The pen stroke that marks a Slate pick. It sweeps in when a team is picked; the stroke wobbles a little so no two look machine-made." replay={replay("highlight")} title="Pick highlight">
          <span className="asset-highlight" key={keys.highlight}>
            <span className="slate-team-label slate-team-label--selected slate-team-label--from-left slate-team-label--new"><span>Kansas City Chiefs</span></span>
          </span>
        </AssetCard>

        <AssetCard note="The Survivor chip, in the sizes the pool uses. Toss the Raiders chip (click) or turn it by hand (drag)." replay={replay("chip")} title="Survivor poker chips">
          <span key={keys.chip} style={{ display: "contents" }}>
            <span className="asset-chip"><SurvivorPokerChip abbreviation="KC" size="slate" teamName="Kansas City Chiefs" /></span>
            <span className="asset-chip"><SurvivorPokerChip abbreviation="BUF" selected size="slate" teamName="Buffalo Bills" /></span>
            <SurvivorPokerChip abbreviation="DAL" official size="ticket" teamName="Dallas Cowboys" />
            <SurvivorPokerChip abbreviation="SF" size="summary" teamName="San Francisco 49ers" unavailable />
          </span>
          <ChipPlayground />
        </AssetCard>

        <AssetCard note="A felt pennant in the school's colors, raised beside a Bowl Pool pick." replay={replay("pennant")} title="Bowl Pool pennants">
          <span key={keys.pennant} style={{ display: "contents" }}>
            {[OREGON, TROY, MARSHALL].map((team) => (
              <span className="bowl-team-pick is-new" key={team.abbreviation}><BowlPennant side="left" team={team} /></span>
            ))}
          </span>
        </AssetCard>

        <AssetCard note="The split-flap counter on the Bowl Card: the large Games Remaining tile and a player's wins." replay={replay("tile")} title="Split-flap tiles">
          <span key={keys.tile} style={{ display: "contents" }}>
            <BowlScoreTile large settled value={12} />
            <BowlScoreTile landDelay={300} settled value={7} />
          </span>
        </AssetCard>

        <AssetCard dark note="The loading screen: the ball in a tight spiral, nose up 40 degrees, with a small wobble. With reduced motion it holds still." title="Loading football">
          <FootballLoader />
        </AssetCard>

        <AssetCard note="The upright W and L stamped on a settled pick, as on the ticket and the Slate." title="Result stamps">
          <AtsResultStamp result="win" tilted={false} variant="ticket" />
          <AtsResultStamp result="loss" tilted={false} variant="ticket" />
          <AtsResultStamp result="win" />
          <AtsResultStamp result="loss" />
        </AssetCard>

        <AssetCard note="The Bowl Pool heading: gold rules that draw in from the stars, varsity lettering, and the season." title="Bowl crest">
          <BowlCrest seasonYear={2026} seasonSuffix="Special" title="BOWL CARD" />
        </AssetCard>

        <AssetCard wide note="What players see once the season is over, and once they are out of the playoff race." title="Season closed banners">
          <div className="asset-banners">
            <SeasonClosedBanner />
            <SeasonClosedBanner eliminated />
          </div>
        </AssetCard>
      </div>
    </section>
  );
}
