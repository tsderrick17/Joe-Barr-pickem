export type AutomationExecutionContext = {
  signal: AbortSignal;
  deadlineAt: number;
};

export class AutomationExecutionTimeoutError extends Error {
  constructor(job: string) {
    super(`${job} exceeded its execution safety timeout.`);
    this.name = "AutomationExecutionTimeoutError";
  }
}

/** Reject the caller at the deadline and signal cooperative tasks to stop. */
export async function withExecutionTimeout<T>(
  job: string,
  timeoutMs: number,
  task: (context: AutomationExecutionContext) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const context = { signal: controller.signal, deadlineAt: Date.now() + timeoutMs };
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Promise.resolve().then(() => task(context)),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          const error = new AutomationExecutionTimeoutError(job);
          reject(error);
          controller.abort(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
