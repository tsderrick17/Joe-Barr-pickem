import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Cooperative cancellation for the automation workers.
 *
 * The lease runner gives each run a deadline. When it passes, the waiting caller is released (the database lease
 * is deliberately kept until it expires, so another run cannot start on top), and this context is cancelled so the
 * run stops starting new work. Cancellation is cooperative and only ever happens *between* stages: a worker calls
 * `checkpoint(stage)` before it starts the next stage or a commit, and passes `providerSignal()` to outside
 * requests. It never interrupts a database call or an email already in flight, so those are still protected by
 * the atomic database functions, delivery receipts and idempotency rules, exactly as before. A cancelled run is
 * safe to repeat: the next run finds the same due work.
 *
 * The context is ambient (per run, via AsyncLocalStorage) so a worker keeps its signature and a worker called
 * outside a lease (a test, a script) simply never cancels.
 */
export class ExecutionCancelledError extends Error {
  readonly stage: string;
  constructor(stage: string, reason?: unknown) {
    super(`The run was cancelled before "${stage}": ${reason instanceof Error ? reason.message : "its deadline passed"}.`);
    this.name = "ExecutionCancelledError";
    this.stage = stage;
  }
}

export type ExecutionContext = {
  signal: AbortSignal;
  /** Epoch milliseconds after which the run must not start more work. */
  deadlineAt: number;
};

const storage = new AsyncLocalStorage<ExecutionContext>();

/** Runs `task` with a context that is cancelled by `cancel` or once `timeoutMs` has passed. */
export function runInExecutionContext<T>(
  timeoutMs: number,
  task: () => Promise<T>,
  now: () => number = Date.now,
): { result: Promise<T>; cancel: (reason: Error) => void } {
  const controller = new AbortController();
  const context: ExecutionContext = { signal: controller.signal, deadlineAt: now() + timeoutMs };
  return {
    result: storage.run(context, task),
    cancel: (reason) => controller.abort(reason),
  };
}

export function currentExecutionContext(): ExecutionContext | undefined {
  return storage.getStore();
}

/** Throws if the run was cancelled or is past its deadline. A no-op outside a lease. */
export function checkpoint(stage: string, now: () => number = Date.now): void {
  const context = storage.getStore();
  if (!context) return;
  if (context.signal.aborted) throw new ExecutionCancelledError(stage, context.signal.reason);
  if (now() > context.deadlineAt) throw new ExecutionCancelledError(stage);
}

/** A request signal that fires at `timeoutMs` or when the run is cancelled, whichever is first. */
export function providerSignal(timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  const context = storage.getStore();
  return context ? AbortSignal.any([timeout, context.signal]) : timeout;
}
