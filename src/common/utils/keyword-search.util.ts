const MAX_EXACT_SEGMENT_LENGTH = 32;
const MAX_SOURCE_TERM_COUNT = 320;
const MIN_SOURCE_NGRAM_LENGTH = 1;
const MAX_SOURCE_NGRAM_LENGTH = 4;
const QUERY_WINDOW_LENGTH = 4;
const CONTROL_CHARACTERS = /[\u0000-\u001f]+/g;
const SEGMENT_SEPARATOR = /[^\p{L}\p{N}]+/gu;

function normalizeKeywordSource(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(CONTROL_CHARACTERS, ' ')
    .trim();
}

function splitSegments(value: string): string[] {
  return normalizeKeywordSource(value)
    .split(SEGMENT_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function pushSourceSegmentTerms(terms: Set<string>, segment: string): void {
  if (!segment) {
    return;
  }

  if (segment.length <= MAX_EXACT_SEGMENT_LENGTH) {
    terms.add(segment);
  }

  if (terms.size >= MAX_SOURCE_TERM_COUNT) {
    return;
  }

  const maxWindowSize = Math.min(MAX_SOURCE_NGRAM_LENGTH, segment.length);
  for (let windowSize = MIN_SOURCE_NGRAM_LENGTH; windowSize <= maxWindowSize; windowSize += 1) {
    for (let start = 0; start <= segment.length - windowSize; start += 1) {
      terms.add(segment.slice(start, start + windowSize));
      if (terms.size >= MAX_SOURCE_TERM_COUNT) {
        return;
      }
    }
  }
}

function buildQuerySegmentTerms(segment: string): string[] {
  if (segment.length <= QUERY_WINDOW_LENGTH) {
    return [segment];
  }

  const terms: string[] = [];
  for (let start = 0; start <= segment.length - QUERY_WINDOW_LENGTH; start += 1) {
    terms.push(segment.slice(start, start + QUERY_WINDOW_LENGTH));
  }

  return terms;
}

export function buildKeywordSearchTerms(...values: Array<string | null | undefined>): string[] {
  const terms = new Set<string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    for (const segment of splitSegments(value)) {
      pushSourceSegmentTerms(terms, segment);
      if (terms.size >= MAX_SOURCE_TERM_COUNT) {
        return Array.from(terms);
      }
    }
  }

  return Array.from(terms);
}

export function buildKeywordFilterTerms(keyword?: string): string[] {
  const terms = new Set<string>();

  if (!keyword) {
    return [];
  }

  for (const segment of splitSegments(keyword)) {
    for (const term of buildQuerySegmentTerms(segment)) {
      terms.add(term);
    }
  }

  return Array.from(terms);
}

export function buildKeywordSearchFilter(keyword?: string): Record<string, unknown> | undefined {
  const terms = buildKeywordFilterTerms(keyword);
  if (terms.length === 0) {
    return undefined;
  }

  return {
    search_terms: {
      $all: terms,
    },
  };
}
