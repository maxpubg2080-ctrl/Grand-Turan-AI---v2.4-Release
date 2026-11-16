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

/**
 * Extracts the first balanced JSON object `{...}` from a model response,
 * handling markdown code fences and surrounding prose cleanly.
 */
export function extractJsonObjectString(rawText: string): string {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return '';

  // Strip code fences if present anywhere
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  const start = candidate.indexOf('{');
  if (start === -1) return candidate;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return candidate.slice(start, i + 1);
      }
    }
  }

  return candidate.slice(start);
}

/**
 * Collapses a list of "(providerLabel, shortError)" failures into a concise
 * per-provider diagnostic summary so one trailing timeout never hides earlier errors.
 */
export function summarizeProviderErrors(
  failures: ReadonlyArray<{ provider: string; detail: string }>
): string {
  const seen = new Map<string, string>();
  for (const item of failures) {
    if (!seen.has(item.provider)) {
      seen.set(item.provider, item.detail.slice(0, 120));
    }
  }
  return Array.from(seen.entries())
    .map(([provider, detail]) => `${provider}: ${detail}`)
    .join(' | ');
}


