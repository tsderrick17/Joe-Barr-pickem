"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  firstName: string;
  loginPin: string | null;
  active: boolean;
  isCommissioner: boolean;
  createdAt?: string;
};

export default function PlayerManagementPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [firstName, setFirstName] = useState("");
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }, []);

  const loadPlayers = useCallback(async () => {
    setErrorMessage("");
    setIsLoading(true);

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setErrorMessage("Please sign in before managing players.");
      setIsLoading(false);
      return;
    }

    const response = await fetch("/api/admin/players", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setErrorMessage(
        data.error ?? "The player list could not be loaded.",
      );
      setIsLoading(false);
      return;
    }

    setPlayers(data.players ?? []);
    setIsLoading(false);
  }, [getAccessToken]);

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialPlayers() {
      const accessToken = await getAccessToken();

      if (!isCurrent) return;

      if (!accessToken) {
        setErrorMessage("Please sign in before managing players.");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/admin/players", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();

      if (!isCurrent) return;

      if (!response.ok) {
        setErrorMessage(data.error ?? "The player list could not be loaded.");
        setIsLoading(false);
        return;
      }

      setPlayers(data.players ?? []);
      setIsLoading(false);
    }

    void loadInitialPlayers();

    return () => {
      isCurrent = false;
    };
  }, [getAccessToken]);

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

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setErrorMessage("Please sign in before adding a player.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/admin/players", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: cleanedName,
        pin,
      }),
    });

    const data = await response.json();

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(data.error ?? "The player could not be added.");
      return;
    }

    setFirstName("");
    setPin("");
    setSuccessMessage(data.message ?? "Player added successfully.");

    await loadPlayers();
  }

  return (
    <main className="min-h-screen bg-[#f7f3e8] px-5 py-10 text-zinc-900 md:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="border-b-2 border-zinc-900 pb-7">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-bold tracking-[0.24em] text-slate-600">
                COMMISSIONER
              </p>

              <h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">
                Player Setup
              </h1>

              <p className="mt-3 text-lg text-zinc-700">
                Add each pool member and assign their private PIN. Use a last initial only when two players share a first name.
            
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

        <div className="grid gap-10 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section>
            <h2 className="font-serif text-3xl font-bold">
              Add a Player
            </h2>

            <p className="mt-2 text-zinc-700">
              Choose a unique four-digit PIN and give it directly to
              the player.
            </p>

            <form
              className="mt-6 border-y-2 border-zinc-900 py-6"
              onSubmit={addPlayer}
            >
              <label
                className="block text-sm font-bold tracking-wide"
                htmlFor="firstName"
              >
                NAME SHOWN IN POOL
              </label>

              <input
                id="firstName"
                type="text"
                autoComplete="off"
                maxLength={40}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-2 w-full border border-zinc-500 bg-white px-4 py-3 text-lg outline-none focus:border-zinc-900"
                placeholder="Mike"
              />

              <label
                className="mt-6 block text-sm font-bold tracking-wide"
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
                className="mt-2 w-full border border-zinc-500 bg-white px-4 py-3 text-center text-2xl tracking-[0.45em] outline-none focus:border-zinc-900"
                placeholder="0000"
              />

              {errorMessage ? (
                <p className="mt-4 font-semibold text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              {successMessage ? (
                <p className="mt-4 border border-green-800 bg-green-50 px-4 py-3 font-semibold text-green-900">
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
                className="mt-6 w-full bg-zinc-900 px-5 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? "Adding player..." : "Add Player"}
              </button>
            </form>

            <p className="mt-4 text-sm text-zinc-600">
PINs are unique login identifiers and may be viewed here at any time.
            </p>
          </section>

          <section>
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-serif text-3xl font-bold">
                Pool Members
              </h2>

              <p className="text-sm font-bold text-slate-600">
                {players.length} TOTAL
              </p>
            </div>

            <div className="mt-6 border-y-2 border-zinc-900">
              {isLoading ? (
                <p className="py-5 text-zinc-600">
                  Loading players...
                </p>
              ) : players.length === 0 ? (
                <p className="py-5 text-zinc-600">
                  No players have been added.
                </p>
              ) : (
                players.map((player) => (
                  <div
                    className="flex items-center justify-between gap-4 border-b border-slate-400 py-4 last:border-b-0"
                    key={player.id}
                  >
                    <span className="font-serif text-2xl">
                      {player.firstName}
                    </span>

<div className="text-right">
  <p className="font-mono text-lg font-bold tracking-[0.18em]">
    {player.loginPin ?? "----"}
  </p>

  <p className="mt-1 text-xs font-bold tracking-wide text-slate-600">
    {player.isCommissioner
      ? "COMMISSIONER"
      : player.active
        ? "ACTIVE"
        : "INACTIVE"}
  </p>
</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
