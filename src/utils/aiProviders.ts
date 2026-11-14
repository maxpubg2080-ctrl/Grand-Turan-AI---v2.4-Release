export function collectProviderKeys(
  env: Record<string, string | undefined>,
  prefix: string
): string[] {
  const candidates: Array<string | undefined> = [
    env[`${prefix}_API_KEY`],
    env[`${prefix}_API_KEY_1`],
    env[`${prefix}_API_KEY_2`],
    env[`${prefix}_API_KEY_3`],
    env[`${prefix}_API_KEY_4`],
    env[`${prefix}_API_KEY_5`],
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
