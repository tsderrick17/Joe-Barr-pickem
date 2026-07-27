"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pin.length !== 4) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: `pin-${pin}@pickemjb.app`,
      password: `pickem-${pin}`,
    });

    setIsSubmitting(false);

    if (error) {
setErrorMessage("That PIN was not recognized. Please try again.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f7f3e8] px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-sm">
        <p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">
          JOE BARR MEMORIAL
        </p>

        <h1 className="mt-2 font-serif text-4xl font-bold leading-tight">
          Lead Pipe Locks 🚬
        </h1>

        <p className="mt-3 text-zinc-700">
          Enter your four-digit PIN to make picks and check the pool.
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
            autoComplete="current-password"
            placeholder="••••"
            value={pin}
            onChange={(event) =>
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
            }
            className="mt-3 w-full border border-zinc-500 bg-white px-4 py-3 text-center text-3xl tracking-[0.5em] outline-none focus:border-zinc-900"
          />

          {errorMessage && (
            <p className="mt-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={pin.length !== 4 || isSubmitting}
            className="mt-6 w-full bg-zinc-900 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Signing in..." : "Enter the Pool"}
          </button>
        </form>

      </div>
    </main>
  );
}
