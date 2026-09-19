/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
/** Bound dependency waits; mutations remain protected by durable state comparisons. */
export async function integrationDeadline<T>(
  work: Promise<T>,
  milliseconds = 3000,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Integration dependency unavailable')),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
