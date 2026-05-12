export interface ParsedAlgorithm {
  exclude: boolean;
  sizes: number[];
  restRatio: number;
  commonWords?: Set<string>;
}

export const DEFAULT_ALGORITHM = "- 0 1 1 2 0.4";

export const DEFAULT_COMMON_WORDS: string[] = [
  // English
  "the", "be", "to", "of", "and", "a", "an", "it", "at",
  "on", "he", "she", "but", "is", "my", "in", "as", "or",
  "if", "by", "we", "us", "i",
  // Русские предлоги
  "в", "во", "на", "с", "со", "к", "ко", "у", "о", "об", "обо",
  "за", "по", "до", "из", "изо", "от", "ото", "для", "про", "при",
  "без", "безо", "над", "надо", "под", "подо", "пред", "предо",
  "ради", "через", "сквозь", "около", "возле", "вдоль", "между",
  "перед", "передо", "среди", "после", "кроме", "вокруг", "против",
  "из-за", "из-под",
  // Союзы, частицы, вводные
  "и", "а", "но", "да", "или", "либо", "ли", "же", "бы", "б", "не", "ни",
  "то", "что", "как", "так", "уж", "ведь", "вот", "лишь", "тоже", "также",
  "если", "хотя", "чтобы", "когда", "пока", "тогда", "пусть",
  // Короткие местоимения
  "я", "ты", "он", "мы", "вы", "мне", "ему", "ей", "им", "нам",
  "вам", "нас", "вас", "их", "его", "её", "ее", "она", "они",
];

const DEFAULT_COMMON_WORDS_SET = new Set(DEFAULT_COMMON_WORDS);

export function buildCommonWordsSet(words: string[] | undefined): Set<string> {
  if (!words || words.length === 0) return new Set();
  const cleaned = words
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
  return new Set(cleaned);
}

export function parseAlgorithm(algorithm: string): ParsedAlgorithm {
  const fallback: ParsedAlgorithm = { exclude: true, sizes: [0, 1, 1, 2], restRatio: 0.4 };
  if (!algorithm) return fallback;
  const parts = algorithm.trim().split(/\s+/);
  if (parts.length < 3) return fallback;
  try {
    const exclude = parts[0] !== "+";
    const restRatio = Number(parts[parts.length - 1]);
    if (!Number.isFinite(restRatio)) return fallback;
    const sizes: number[] = [];
    for (let i = 1; i < parts.length - 1; i++) {
      const n = Number(parts[i]);
      sizes.push(Number.isFinite(n) ? n : 0);
    }
    return { exclude, sizes, restRatio };
  } catch {
    return fallback;
  }
}

export function serializeAlgorithm(a: ParsedAlgorithm): string {
  return [a.exclude ? "-" : "+", ...a.sizes, a.restRatio].join(" ");
}

export function withRestRatio(algorithm: string, restRatio: number): string {
  const a = parseAlgorithm(algorithm);
  a.restRatio = Math.max(0, Math.min(1, restRatio));
  return serializeAlgorithm(a);
}

export function numBoldFor(word: string, algo: ParsedAlgorithm): number {
  if (word.length === 0) return 0;
  if (algo.exclude) {
    const set = algo.commonWords ?? DEFAULT_COMMON_WORDS_SET;
    if (set.has(word.toLowerCase())) return 0;
  }
  const index = word.length - 1;
  if (index < algo.sizes.length) {
    return algo.sizes[index];
  }
  return Math.ceil(word.length * algo.restRatio);
}

const WORD_RE = /[\p{L}\p{N}]+/gu;

export interface WordSpan {
  start: number;
  end: number;
  boldEnd: number;
}

export function findWordSpans(text: string, algo: ParsedAlgorithm): WordSpan[] {
  const spans: WordSpan[] = [];
  WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(text)) !== null) {
    const word = m[0];
    const n = numBoldFor(word, algo);
    if (n <= 0) continue;
    spans.push({
      start: m.index,
      end: m.index + word.length,
      boldEnd: m.index + Math.min(n, word.length),
    });
  }
  return spans;
}
