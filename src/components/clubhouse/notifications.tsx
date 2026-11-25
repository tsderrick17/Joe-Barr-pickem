"use client";

import { useId, useState, type ReactNode } from "react";
import { AddToHomeScreen } from "@/components/add-to-home-screen";
import { essentials, full, regular, useNotificationChoices, type NotificationChoices } from "@/components/notification-settings";
import { PhoneNotifications } from "@/components/phone-notifications";
import { haptic } from "@/lib/haptics-client";

/** The three email plans, plainly named, with what each one sends in a line. */
const PLANS = [
  { key: "essentials", title: "Essentials", line: "Pick reminders and the Tuesday recap.", choices: essentials },
  { key: "regular", title: "Regular", line: "Essentials, plus the Slate, final lines, International locks and playoff recaps.", choices: regular },
  { key: "full", title: "Full Card", line: "Everything in Regular, plus every public pick reveal.", choices: full },
] as const;

/** Every email the fine-tune list offers, grouped as the pool's week runs. */
const GROUPS: Array<{ title: string; note?: string; rows: Array<{ key: keyof NotificationChoices; title: string; note: string }> }> = [
  { title: "The Slate", rows: [
    { key: "weekly", title: "Fresh Slate on Wednesday", note: "Next week’s preliminary Slate, before official lines." },
    { key: "earlyLock", title: "International lock", note: "Before an International game locks: its official line and kickoff." },
  ] },
  { title: "Pick reminders", note: "Only when you still have a pick to make.", rows: [
    { key: "pickDueSundayEarly", title: "Sunday early", note: "Sunday at 11 AM ET." },
    { key: "pickDueSundayAfternoon", title: "Sunday afternoon", note: "Sunday at 3 PM ET." },
    { key: "pickDuePrimetime", title: "Sunday & Monday primetime", note: "Sunday at 6 PM ET and Monday at 5 PM ET." },
  ] },
  { title: "Pick reveals", note: "After kickoff, only when someone picked a game in that window.", rows: [
    { key: "sundayEarlyReveal", title: "Sunday early window", note: "When the early games kick off." },
    { key: "sundayLateReveal", title: "Sunday late window", note: "When the late games kick off." },
    { key: "featuredWindowReveal", title: "Primetime and International", note: "At kickoff of those games." },
  ] },
  { title: "Recaps & playoffs", rows: [
    { key: "weeklyRecap", title: "Weekly recap", note: "Tuesday morning: results and standings." },
    { key: "playoffDayRecap", title: "Daily playoff recap", note: "After every playoff game day is final." },
    { key: "playoffPublicReveal", title: "Playoff pick reveals", note: "At every playoff kickoff." },
  ] },
];

/** An on/off switch with its words beside it: the whole row is the switch. */
function SwitchRow({ checked, onChange, title, note }: { checked: boolean; onChange: (checked: boolean) => void; title: string; note?: ReactNode }) {
  return (
    <label className="club-switch-row">
      <span className="club-switch-words"><b>{title}</b>{note ? <small>{note}</small> : null}</span>
      <input checked={checked} className="club-switch" onChange={(event) => { haptic("tick"); onChange(event.target.checked); }} role="switch" type="checkbox" />
    </label>
  );
}

/** A row of choices, one of which is on (the email plan, the final-lines pace). */
function Choices<T extends string>({ label, options, value, onChoose }: { label: string; options: Array<{ key: T; title: string }>; value: T | null; onChoose: (key: T) => void }) {
  return (
    <div aria-label={label} className="club-choices" role="group">
      {options.map((option) => (
        <button aria-pressed={value === option.key} key={option.key} onClick={() => { haptic("tick"); onChoose(option.key); }} type="button">{option.title}</button>
      ))}
    </div>
  );
}

/**
 * The clubhouse's Notifications: a card of the ticket's paper, set like a phone's settings. On this phone first (the app and its alerts),
 * then email: one switch for pool emails, the address, a plan in three plain choices with what it sends underneath, and every single
 * email folded away under "Choose each email" for anyone who wants to pick them one by one. Saves exactly what the Notifications page saves.
 */
export function ClubNotifications() {
  const choices = useNotificationChoices();
  const { profile, email, setEmail, enabled, setEnabled, preferences, setPreferences, update, pace, finalLineChoice, message, error, saving, save } = choices;
  const [each, setEach] = useState(false);
  const emailId = useId();
  if (!profile && !error) return <div className="club-notify-card"><p className="club-notify-note">Loading your notifications…</p></div>;
  const plan = PLANS.find((option) => option.key === pace);
  return (
    <div className="club-notify-card">
      <header className="club-notify-head"><i>Your</i><h3>NOTIFICATIONS</h3></header>

      <section aria-label="On this phone" className="club-notify-section">
        <h4>On this phone</h4>
        <div className="club-notify-phone">
          <AddToHomeScreen variant="card" />
          <PhoneNotifications />
        </div>
      </section>

      <form className="club-notify-section" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <h4>Email</h4>
        <div className="club-notify-list">
          <SwitchRow checked={enabled} note="You can change how many below." onChange={setEnabled} title="Send me pool emails" />
          <label className="club-notify-field" htmlFor={emailId}>
            <span>Email address</span>
            <input autoComplete="email" id={emailId} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
          </label>
        </div>

        {enabled ? (
          <>
            <h5>How many emails</h5>
            <Choices label="Email plan" onChoose={(key) => setPreferences(PLANS.find((option) => option.key === key)!.choices)} options={PLANS.map(({ key, title }) => ({ key, title }))} value={plan ? plan.key : null} />
            <p className="club-notify-note">{plan ? plan.line : "Your own mix: see each email below."}</p>

            <button aria-expanded={each} className="club-notify-fold" onClick={() => setEach((open) => !open)} type="button">
              <span>Choose each email</span>
              <svg aria-hidden="true" fill="none" height="10" viewBox="0 0 12 8" width="12"><path d="M1.5 1.75 6 6.25l4.5-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
            </button>
            {each ? (
              <div className="club-notify-each">
                <h5>Final gameday lines</h5>
                <Choices label="Final gameday lines" onChoose={(key) => update(key === "all" ? { finalLines: true, sundayFinalLines: false } : key === "sunday" ? { finalLines: false, sundayFinalLines: true } : { finalLines: false, sundayFinalLines: false })} options={[{ key: "none", title: "None" }, { key: "sunday", title: "Sundays" }, { key: "all", title: "Every gameday" }]} value={finalLineChoice} />
                {GROUPS.map((group) => (
                  <div key={group.title}>
                    <h5>{group.title}</h5>
                    {group.note ? <p className="club-notify-note">{group.note}</p> : null}
                    <div className="club-notify-list">
                      {group.rows.map((row) => <SwitchRow checked={preferences[row.key]} key={row.key} note={row.note} onChange={(checked) => update({ [row.key]: checked })} title={row.title} />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="club-notify-note is-sender">So they never land in spam, add <b>{profile?.senderEmail || "the PickemJB address"}</b> to your contacts as PickemJB.</p>
          </>
        ) : null}

        {error ? <p className="club-notify-said is-error" role="alert">{error}</p> : null}
        {message ? <p className="club-notify-said" role="status">{message}</p> : null}
        <button className="club-notify-save" disabled={saving} type="submit">{saving ? "Saving…" : "Save"}</button>
      </form>
    </div>
  );
}
