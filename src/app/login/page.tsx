"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthApiError } from "@supabase/supabase-js";
import { getFreshSession } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function redirectSignedInPlayer() {
      const session = await getFreshSession();
      if (active && session) {
        window.location.replace("/");
      }
    }

    void redirectSignedInPlayer();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pin.length !== 4) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `pin-${pin}@pickemjb.app`,
        password: `pickem-${pin}`,
      });

      if (error) {
        if (
          error instanceof AuthApiError &&
          (error.status === 400 || error.status === 401)
        ) {
          setErrorMessage("That PIN was not recognized. Please try again.");
        } else if (error instanceof AuthApiError && error.status === 429) {
          setErrorMessage(
            "Too many attempts were made. Wait a minute, then try again.",
          );
        } else {
          setErrorMessage(
            "Sign-in is temporarily unavailable. Check your connection and try again.",
          );
        }
        return;
      }

      if (!data.session) {
        setErrorMessage(
          "Your PIN was accepted, but the session did not finish. Please try once more.",
        );
        return;
      }

      // signInWithPassword normally persists this automatically. Writing the
      // returned session once more makes that handoff deterministic before the
      // app navigates, which prevents a newly signed-in player from bouncing
      // back to the PIN screen on a slow browser or phone.
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        setErrorMessage(
          "Your PIN was accepted, but the session did not finish. Please try once more.",
        );
        return;
      }

      window.location.assign("/");
    } catch {
      setErrorMessage(
        "Sign-in could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f3e8] px-4 py-8 text-zinc-900 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-sm">
        <p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">
          JOE BARR MEMORIAL
        </p>

        <h1 className="mt-2 font-serif text-4xl font-bold leading-tight">
          Lead Pipe Locks
        </h1>

        <p className="mt-3 text-zinc-700">
          Enter your four-digit PIN to make picks and check the Standings.
        </p>

        <form
          className="mt-10 border-y-2 border-zinc-900 py-8"
          onSubmit={handleSubmit}
        >
          <label
            className="block text-sm font-bold tracking-wide"
            htmlFor="pin"
          >
            FOUR-DIGIT PIN
          </label>

          <input
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            minLength={4}
            pattern="[0-9]*"
            autoComplete="one-time-code"
            placeholder="••••"
            value={pin}
            onChange={(event) =>
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
            }
            className="mt-3 min-h-14 w-full border border-zinc-500 bg-white px-4 py-3 text-center text-3xl tracking-[0.5em] outline-none focus:border-zinc-900"
          />

          {errorMessage && (
            <p className="mt-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={pin.length !== 4 || isSubmitting}
            className="mt-6 min-h-12 w-full bg-zinc-900 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Signing in..." : "Enter Pick'em"}
          </button>
        </form>

      </div>
    </main>
  );
}
