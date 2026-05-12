import { buildKeywordFilterTerms, buildKeywordSearchFilter, buildKeywordSearchTerms } from './keyword-search.util';

describe('keyword-search.util', () => {
  it('builds overlapping terms for Chinese title and summary search', () => {
    const sourceTerms = new Set(buildKeywordSearchTerms('测试图包二！', '测试图包二！测试图包二！'));
    const keywordTerms = buildKeywordFilterTerms('图包二');

    expect(keywordTerms.length).toBeGreaterThan(0);
    expect(keywordTerms.every((term) => sourceTerms.has(term))).toBe(true);
  });

  it('matches long substrings by query windows instead of requiring the exact whole term', () => {
    const sourceTerms = new Set(buildKeywordSearchTerms('这是测试图包二测试内容'));
    const keywordTerms = buildKeywordFilterTerms('图包二测试');

    expect(keywordTerms).toEqual(['图包二测', '包二测试']);
    expect(keywordTerms.every((term) => sourceTerms.has(term))).toBe(true);
  });

  it('supports one-character queries without requiring a full segment match', () => {
    const sourceTerms = new Set(buildKeywordSearchTerms('测试图包二'));
    const keywordTerms = buildKeywordFilterTerms('图');

    expect(keywordTerms).toEqual(['图']);
    expect(keywordTerms.every((term) => sourceTerms.has(term))).toBe(true);
  });

  it('returns a search_terms filter for normalized keyword input', () => {
    expect(buildKeywordSearchFilter(' 图包二 ')).toEqual({
      search_terms: {
        $all: buildKeywordFilterTerms(' 图包二 '),
      },
    });
  });

  it('returns undefined for empty keyword input', () => {
    expect(buildKeywordSearchFilter('   ')).toBeUndefined();
  });
});
