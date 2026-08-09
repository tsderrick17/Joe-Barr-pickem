import { supabaseAdmin } from "@/lib/supabase-admin";
import { scheduleProviderCooldownMinutes } from "@/lib/schedule-provider-backoff.js";

const providerJob = "schedule_refresh";

type CircuitRow = {
  consecutive_failures: number;
  next_retry_at: string;
  last_error: string;
};

export async function getScheduleProviderCircuit(now = new Date()) {
  const { data, error } = await supabaseAdmin
    .from("provider_failure_circuits")
    .select("consecutive_failures, next_retry_at, last_error")
    .eq("provider_job", providerJob)
    .maybeSingle();
  if (error) throw new Error("The schedule-provider cooldown could not be checked.");

  const circuit = data as CircuitRow | null;
  if (!circuit || new Date(circuit.next_retry_at).getTime() <= now.getTime()) {
    return { blocked: false as const, consecutiveFailures: circuit?.consecutive_failures ?? 0 };
  }
  return {
    blocked: true as const,
    consecutiveFailures: circuit.consecutive_failures,
    retryAt: circuit.next_retry_at,
    lastError: circuit.last_error,
  };
}

export async function recordScheduleProviderFailure(reason: unknown, now = new Date()) {
  const current = await getScheduleProviderCircuit(now);
  const consecutiveFailures = current.consecutiveFailures + 1;
  const nextRetryAt = new Date(
    now.getTime() + scheduleProviderCooldownMinutes(consecutiveFailures) * 60_000,
  ).toISOString();
  const lastError = reason instanceof Error
    ? reason.message.slice(0, 500)
    : "The NFL schedule provider failed.";
  const { error } = await supabaseAdmin.from("provider_failure_circuits").upsert({
    provider_job: providerJob,
    consecutive_failures: consecutiveFailures,
    last_failed_at: now.toISOString(),
    next_retry_at: nextRetryAt,
    last_error: lastError,
    updated_at: now.toISOString(),
  }, { onConflict: "provider_job" });
  if (error) throw new Error("The schedule-provider cooldown could not be saved.");
  return { consecutiveFailures, retryAt: nextRetryAt };
}

export async function clearScheduleProviderCircuit() {
  const { error } = await supabaseAdmin
    .from("provider_failure_circuits")
    .delete()
    .eq("provider_job", providerJob);
  if (error) throw new Error("The schedule-provider cooldown could not be cleared.");
}
