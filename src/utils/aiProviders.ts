export function collectProviderKeys(
  env: Record<string, string | undefined>,
  prefix: string
): string[] {
  const candidates: Array<string | undefined> = [
    env[`${prefix}_API_KEY`],
    env[`${prefix}_API_KEY_1`],
    env[`${prefix}_API_KEY1`],
    env[`${prefix}_API_KEY_2`],
    env[`${prefix}_API_KEY2`],
    env[`${prefix}_API_KEY_3`],
    env[`${prefix}_API_KEY3`],
    env[`${prefix}_API_KEY_4`],
    env[`${prefix}_API_KEY4`],
    env[`${prefix}_API_KEY_5`],
    env[`${prefix}_API_KEY5`],
  ];

  const listRaw = env[`${prefix}_API_KEYS`];
  if (listRaw) {
    for (const part of listRaw.split(/[\n,;]+/)) {
      candidates.push(part);
    }
  }

  const placeholders = new Set([
    'MY_GEMINI_API_KEY',
    'YOUR_API_KEY',
    'REPLACE_ME',
    'NONE',
  ]);

  const unique: string[] = [];
  for (const raw of candidates) {
    const cleaned = (raw || '').trim().replace(/^["']|["']$/g, '');
    if (
      cleaned.length >= 10 &&
      !placeholders.has(cleaned.toUpperCase()) &&
      !unique.includes(cleaned)
    ) {
      unique.push(cleaned);
    }
  }
  return unique;
}

/**
 * Rotates an array by `cursor % items.length` without mutating the input so
 * consecutive/parallel passport requests distribute evenly across all keys.
 */
export function rotateProviderKeys<T>(items: readonly T[], cursor: number): T[] {
  if (items.length <= 1) return [...items];
  const offset = ((cursor % items.length) + items.length) % items.length;
  if (offset === 0) return [...items];
  return [...items.slice(offset), ...items.slice(0, offset)];
}

/**
 * Interleaves provider queues round-by-round (taking 1 attempt from each queue
 * before moving to each queue's next fallback) so a slow/rate-limited provider
 * does not block fast alternative providers behind 6+ sequential retries.
 */
export function interleaveProviderQueues<T>(queues: ReadonlyArray<readonly T[]>): T[] {
  const result: T[] = [];
  const maxLen = queues.reduce((max, q) => Math.max(max, q.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const q of queues) {
      if (i < q.length) {
        result.push(q[i]);
      }
    }
  }
  return result;
}

