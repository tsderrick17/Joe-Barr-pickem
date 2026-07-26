"use client";

import { useState } from "react";

export default function LoginPage() {
  const [pin, setPin] = useState("");

  return (
    <main className="min-h-screen bg-[#f7f3e8] px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-sm">
        <p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">
          JOE BARR MEMORIAL
        </p>

        <h1 className="mt-2 font-serif text-4xl font-bold leading-tight">
          Best Bets Pick&apos;em
        </h1>

        <p className="mt-3 text-zinc-700">
          Enter your four-digit PIN to make picks and check the pool.
        </p>

        <form className="mt-10 border-y-2 border-zinc-900 py-8">
          <label
            className="block text-sm font-bold tracking-wide"
            htmlFor="pin"
          >
            FOUR-DIGIT PIN
          </label>

          <input
            id="pin"
            inputMode="numeric"
            maxLength={4}
            minLength={4}
            pattern="[0-9]*"
            placeholder="••••"
            value={pin}
            onChange={(event) =>
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
            }
            className="mt-3 w-full border border-zinc-500 bg-white px-4 py-3 text-center text-3xl tracking-[0.5em] outline-none focus:border-zinc-900"
          />

          <button
            type="submit"
            disabled={pin.length !== 4}
            className="mt-6 w-full bg-zinc-900 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enter the Pool
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-600">
          Honor the tradition. Eliminate the paperwork.
        </p>
      </div>
    </main>
  );
}