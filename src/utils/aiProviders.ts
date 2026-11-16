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

export interface GeminiCatalogModel {
  name?: string;
  supportedGenerationMethods?: string[];
}

export interface OpenAiCatalogModel {
  id?: string;
  active?: boolean;
  architecture?: {
    input_modalities?: string[];
  };
  input_modalities?: string[];
}

function dedupeStrings(items: readonly string[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    const cleaned = item.trim();
    if (cleaned && !out.includes(cleaned)) {
      out.push(cleaned);
    }
  }
  return out;
}

/**
 * Selects live generateContent-capable Gemini/Gemma vision models from a key's
 * `/v1beta/models` catalog while filtering out retired 1.x/2.x and audio/TTS/image-gen IDs.
 */
export function selectGeminiVisionModels(
  catalogModels: readonly GeminiCatalogModel[],
  options: { useThinking?: boolean; maxModels?: number } = {}
): string[] {
  const { useThinking = false, maxModels = 5 } = options;

  const candidates = catalogModels
    .filter((m) => {
      const methods = m.supportedGenerationMethods || [];
      return methods.length === 0 || methods.includes('generateContent');
    })
    .map((m) => String(m.name || '').replace(/^models\//, '').trim())
    .filter((id) => {
      if (!id) return false;
      if (
        /^(gemini-1\.|gemini-2\.0|gemini-2\.5|gemini-pro$|embedding|text-embedding|imagen|veo|lyria|aqa)/i.test(
          id
        )
      ) {
        return false;
      }
      if (/(-tts|-image|transcribe|live|robotics|computer-use|embedding)/i.test(id)) {
        return false;
      }
      return /^(gemini-|gemma-4|gemma-3n)/i.test(id);
    });

  if (candidates.length === 0) {
    return ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  }

  const scoreModel = (id: string): number => {
    const lower = id.toLowerCase();
    if (lower === 'gemini-4-hydrogen') return useThinking ? 100 : 96;
    if (lower === 'gemini-3.1-flash-lite') return 94;
    if (/gemini-3\.8-flash$/.test(lower)) return 95;
    if (/gemini-3\.6-flash$/.test(lower)) return 93;
    if (/gemini-3\.5-flash-lite$/.test(lower)) return 92;
    if (/gemini-flash-latest$/.test(lower)) return 91;
    if (/gemini-flash-lite-latest$/.test(lower)) return 90;
    if (/gemini-3.*flash/.test(lower)) return 88;
    if (/gemini-4.*flash/.test(lower)) return 86;
    if (/gemini-3.*pro/.test(lower)) return useThinking ? 89 : 72;
    if (/gemma-4/.test(lower)) return 70;
    return 60;
  };

  const sorted = dedupeStrings(candidates).sort((a, b) => scoreModel(b) - scoreModel(a));
  return sorted.slice(0, maxModels);
}

/**
 * Selects live `:free` image-capable models from OpenRouter's `/api/v1/models` catalog.
 */
export function selectOpenRouterFreeVisionModels(
  catalogModels: readonly OpenAiCatalogModel[],
  maxModels: number = 5
): string[] {
  const freeImageIds = catalogModels
    .filter((m) => {
      const id = String(m.id || '');
      const modalities = m.architecture?.input_modalities || m.input_modalities || [];
      return id.endsWith(':free') && modalities.includes('image');
    })
    .map((m) => String(m.id || '').trim());

  const priority = [
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3.5-super-vl:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'inclusionai/ling-3.2-flash:free',
    'dots-studio/dots-3-note-preview:free',
  ];

  if (freeImageIds.length === 0) {
    return [...priority.slice(0, Math.max(1, maxModels - 1)), 'openrouter/free'];
  }

  const score = (id: string) => {
    const idx = priority.indexOf(id);
    if (idx !== -1) return 100 - idx;
    if (/gemma-4|vl|omni|vision/i.test(id)) return 75;
    return 50;
  };

  const ordered = dedupeStrings(freeImageIds).sort((a, b) => score(b) - score(a));
  return [...ordered.slice(0, Math.max(1, maxModels - 1)), 'openrouter/free'];
}

/**
 * Selects active Groq vision models (e.g., `qwen/qwen3.8-27b`) from `/openai/v1/models`.
 */
export function selectGroqVisionModels(
  catalogModels: readonly OpenAiCatalogModel[],
  maxModels: number = 3
): string[] {
  const visionIds = catalogModels
    .filter((m) => m.active !== false)
    .map((m) => String(m.id || '').trim())
    .filter(
      (id) =>
        Boolean(id) &&
        !/(whisper|tts|guard|playai|orpheus)/i.test(id) &&
        /(qwen3\.8|muse-spark|vision|llava|pixtral|llama-4)/i.test(id)
    );

  const defaults = ['qwen/qwen3.8-27b', 'meta-models/muse-spark-open'];
  if (visionIds.length === 0) {
    return defaults.slice(0, maxModels);
  }

  const score = (id: string) => {
    if (id === 'qwen/qwen3.8-27b') return 100;
    if (id === 'meta-models/muse-spark-open') return 90;
    return 70;
  };

  return dedupeStrings(visionIds).sort((a, b) => score(b) - score(a)).slice(0, maxModels);
}

/**
 * Selects active SambaNova vision/multimodal models (e.g., `gemma-4-31B-it`) from `/v1/models`.
 */
export function selectSambaNovaVisionModels(
  catalogModels: readonly OpenAiCatalogModel[],
  maxModels: number = 3
): string[] {
  const visionIds = catalogModels
    .filter((m) => {
      const id = String(m.id || '').trim();
      if (!id || /(whisper|tts|audio|embed)/i.test(id)) return false;
      const modalities = m.input_modalities || m.architecture?.input_modalities || [];
      return modalities.includes('image') || /(gemma-4|vision|vl|llama-4|pixtral)/i.test(id);
    })
    .map((m) => String(m.id || '').trim());

  if (visionIds.length === 0) {
    return ['gemma-4-31B-it'];
  }

  const score = (id: string) => {
    if (/^gemma-4-31B-it$/i.test(id)) return 100;
    if (/gemma-4/i.test(id)) return 90;
    if (/vision|vl/i.test(id)) return 80;
    return 60;
  };

  return dedupeStrings(visionIds).sort((a, b) => score(b) - score(a)).slice(0, maxModels);
}

/**
 * Selects active Mistral vision-capable models (`mistral-small-latest`, `pixtral-*`) from `/v1/models`.
 */
export function selectMistralVisionModels(
  catalogModels: readonly OpenAiCatalogModel[],
  maxModels: number = 3
): string[] {
  const visionIds = catalogModels
    .map((m) => String(m.id || '').trim())
    .filter(
      (id) =>
        Boolean(id) &&
        !/(embed|ocr|codestral|voxtral)/i.test(id) &&
        /(mistral-small-latest|mistral-medium-latest|pixtral|mistral-small-26|mistral-medium-25)/i.test(id)
    );

  const defaults = ['mistral-small-latest', 'mistral-medium-latest', 'pixtral-12b-2409'];
  if (visionIds.length === 0) {
    return defaults.slice(0, maxModels);
  }

  const score = (id: string) => {
    if (id === 'mistral-small-latest') return 100;
    if (id === 'mistral-medium-latest') return 95;
    if (id.includes('pixtral')) return 90;
    return 70;
  };

  return dedupeStrings(visionIds).sort((a, b) => score(b) - score(a)).slice(0, maxModels);
}



