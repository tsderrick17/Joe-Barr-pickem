"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { lastSeenLabel, playerTotals, visitsLabel } from "@/lib/player-presence.js";

function reportNetworkError(error: Error, endpoint: string, method: "GET" | "POST") {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.withScope((scope) => {
      scope.setTag("app.route", "/admin/players");
      scope.setTag("error.kind", "network");
      const request = endpoint === "/api/admin/players"
        ? { endpoint: "/api/admin/players", method }
        : { endpoint, method };
      scope.setContext("request", request);
      Sentry.captureException(error);
    });
  });
}

type Player = {
  id: string;
  firstName: string;
  loginPin: string | null;
  active: boolean;
  isCommissioner: boolean;
  forfeited?: boolean;
  emailNotificationsEnabled: boolean;
  createdAt?: string;
  lastActiveAt?: string | null;
  hasApp: boolean;
  /** `null` when the notification records could not be read. */
  notificationsOn: boolean | null;
  /** Days with a visit in the last seven; `null` when the visit records could not be read. */
  visitDays: number | null;
  lastSeenOn: string | null;
};

type Sort = "name" | "seen";

export default function PlayerManagementPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [firstName, setFirstName] = useState("");
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reinstating, setReinstating] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("name");
  /** When the list was loaded: "2h ago" is counted from here. */
  const [loadedAt, setLoadedAt] = useState(0);
  const totals = useMemo(() => playerTotals(players), [players]);
  const quiet = useMemo(() => players.filter((player) => player.active && player.visitDays === 0), [players]);
  const shown = useMemo(() => sort === "name" ? players : [...players].sort((a, b) => (b.lastActiveAt ? Date.parse(b.lastActiveAt) : -1) - (a.lastActiveAt ? Date.parse(a.lastActiveAt) : -1)), [players, sort]);

  const loadPlayers = useCallback(async () => {
    setErrorMessage("");
    setIsLoading(true);

    try {
      const response = await fetchWithSession("/api/admin/players");
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error ?? "The player list could not be loaded.");
        return;
      }

      setPlayers(data.players ?? []);
      setLoadedAt(Date.now());
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) {
        setErrorMessage("Please sign in before managing players.");
        return;
      }

      const error = reason instanceof Error ? reason : new Error("Player list request failed.");
      reportNetworkError(error, "/api/admin/players", "GET");
      setErrorMessage("The player list could not be loaded. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    window.queueMicrotask(() => void loadPlayers());
  }, [loadPlayers]);

  /** Reverse a player's Pick'em forfeit. The button asks twice, because the player cannot un-reverse it. */
  async function reinstate(player: Player) {
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetchWithSession("/api/admin/pickem-forfeits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setErrorMessage(data.error ?? "The forfeit could not be reversed."); return; }
      setReinstating(null);
      setSuccessMessage(`${player.firstName} is back in the Pick’em.`);
      await loadPlayers();
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) { setErrorMessage("Please sign in before reinstating a player."); return; }
      reportNetworkError(reason instanceof Error ? reason : new Error("Reinstate request failed."), "/api/admin/pickem-forfeits", "POST");
      setErrorMessage("The forfeit could not be reversed. Check your connection and try again.");
    }
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanedName = firstName.trim();

    if (!cleanedName) {
      setErrorMessage("Enter the player's first name.");
      return;
    }

    if (pin.length !== 4) {
      setErrorMessage("Enter a four-digit PIN.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetchWithSession("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: cleanedName, pin }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error ?? "The player could not be added.");
        return;
      }

      setFirstName("");
      setPin("");
      setSuccessMessage(data.message ?? "Player added successfully.");
      await loadPlayers();
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) {
        setErrorMessage("Please sign in before adding a player.");
      } else {
        const error = reason instanceof Error ? reason : new Error("Player creation request failed.");
        reportNetworkError(error, "/api/admin/players", "POST");
        setErrorMessage("The player could not be added. Check your connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="commissioner-subpage min-h-screen px-5 py-6 text-(color:--themed-text-31) md:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="desk-rule-bottom pb-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-bold tracking-[0.24em] text-slate-600">
                COMMISSIONER
              </p>

              <h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">
                Players
              </h1>

              <p className="mt-3 text-lg text-(color:--themed-text-29)">
                Who is in the pool, what they get, and when they were last here.
              </p>
            </div>

            <Link
              className="shrink-0 font-bold underline"
              href="/admin"
            >
              System health
            </Link>
          </div>
        </header>

        <div className="players-layout">
          <section className="players-add">
            <h2 className="font-serif text-3xl font-bold">
              Add a Player
            </h2>

            <p className="mt-2 text-(color:--themed-text-29)">
              Give each player their own four-digit PIN. Add a last initial only when two players share a first name.
            </p>

            <form
              className="mt-4 desk-rule-y py-4"
              onSubmit={addPlayer}
            >
              <label
                className="block text-sm font-bold tracking-wide"
                htmlFor="firstName"
              >
                NAME SHOWN IN STANDINGS
              </label>

              <input
                id="firstName"
                type="text"
                autoComplete="off"
                maxLength={40}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-2 w-full desk-input px-4 py-2.5 text-lg outline-none"
                placeholder="Mike"
              />

              <label
                className="mt-4 block text-sm font-bold tracking-wide"
                htmlFor="pin"
              >
                FOUR-DIGIT PIN
              </label>

              <input
                id="pin"
                type="text"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={4}
                minLength={4}
                pattern="[0-9]*"
                value={pin}
                onChange={(event) =>
                  setPin(
                    event.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                className="mt-2 w-full desk-input px-4 py-2.5 text-center text-2xl tracking-[0.45em] outline-none"
                placeholder="0000"
              />

              {errorMessage ? (
                <p className="mt-4 font-semibold text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              {successMessage ? (
                <p className="mt-4 desk-status is-ok px-4 py-3 font-semibold">
                  {successMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  !firstName.trim() ||
                  pin.length !== 4 ||
                  isSubmitting
                }
                className="mt-4 w-full desk-button-solid px-5 py-3 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? "Adding player..." : "Add Player"}
              </button>
            </form>

            <p className="mt-4 text-sm text-(color:--themed-text-28)">
              PINs are unique login identifiers and may be viewed here at any time.
            </p>
          </section>

          <section className="players-roster">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-serif text-3xl font-bold">
                The Pool
              </h2>

              <p className="text-sm font-bold text-slate-600">
                {players.length} TOTAL
              </p>
            </div>

            {errorMessage && !isLoading ? (
              <div className="mt-6 flex items-center justify-between gap-4 desk-status is-alert px-4 py-3 text-sm">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  className="shrink-0 font-bold underline"
                  onClick={() => void loadPlayers()}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {isLoading ? (
              <p className="py-5 text-(color:--themed-text-28)">
                Loading players...
              </p>
            ) : players.length === 0 ? (
              <p className="py-5 text-(color:--themed-text-28)">
                No players have been added.
              </p>
            ) : (
              <>
                <dl className="players-totals">
                  <div><dt>Active players</dt><dd>{totals.players}</dd></div>
                  <div><dt>Have the app</dt><dd>{totals.withApp}<span> of {totals.players}</span></dd></div>
                  <div><dt>Get notifications</dt><dd>{totals.withNotifications}<span> of {totals.players}</span></dd></div>
                  <div><dt>Get emails</dt><dd>{totals.withEmails}<span> of {totals.players}</span></dd></div>
                </dl>

                {quiet.length > 0 ? (
                  <p className="players-quiet">
                    Not here in the last 7 days: <strong>{quiet.map((player) => player.firstName).join(", ")}</strong>
                  </p>
                ) : null}

                <div className="players-sort" role="group" aria-label="Order the players">
                  <span>Order by</span>
                  <button aria-pressed={sort === "name"} className="desk-button" onClick={() => setSort("name")} type="button">Name</button>
                  <button aria-pressed={sort === "seen"} className="desk-button" onClick={() => setSort("seen")} type="button">Last seen</button>
                </div>

                <ul className="players-list">
                  {shown.map((player) => (
                    <li className="player-card" key={player.id}>
                      <div className="player-card-head">
                        <h3 className="player-name">
                          {player.firstName}
                          {player.isCommissioner || !player.active ? (
                            <span className="player-role">{player.isCommissioner ? "Commissioner" : "Inactive"}</span>
                          ) : null}
                        </h3>
                        <p className="player-pin">{player.loginPin ?? "----"}</p>
                      </div>

                      <ul className="player-flags" aria-label={`What ${player.firstName} has turned on`}>
                        <li className={`player-flag${player.emailNotificationsEnabled ? " is-on" : ""}`}>Emails {player.emailNotificationsEnabled ? "on" : "off"}</li>
                        <li className={`player-flag${player.hasApp ? " is-on" : ""}`}>App {player.hasApp ? "installed" : "not yet"}</li>
                        {player.notificationsOn === null ? null : (
                          <li className={`player-flag${player.notificationsOn ? " is-on" : ""}`}>Notifications {player.notificationsOn ? "on" : "off"}</li>
                        )}
                      </ul>

                      <dl className="player-facts">
                        <div><dt>Last seen</dt><dd>{lastSeenLabel(player.lastActiveAt, loadedAt)}</dd></div>
                        <div><dt>This week</dt><dd>{visitsLabel(player.visitDays) ?? "Unknown"}</dd></div>
                        <div><dt>Last on</dt><dd>{player.lastSeenOn ?? "Not recorded yet"}</dd></div>
                      </dl>

                      {player.forfeited ? (
                        <p className="player-forfeit">
                          <span className="player-forfeit-tag">Forfeited the Pick’em playoffs</span>
                          {reinstating === player.id ? (
                            <>
                              <button className="player-forfeit-button" onClick={() => void reinstate(player)} type="button">Yes, reinstate {player.firstName}</button>
                              <button className="player-forfeit-button" onClick={() => setReinstating(null)} type="button">Cancel</button>
                            </>
                          ) : (
                            <button className="player-forfeit-button" onClick={() => setReinstating(player.id)} type="button">Reinstate</button>
                          )}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
