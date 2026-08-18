export interface KnowledgeDocument {
  id: string;
  packageId: string;
  name: string;
  text: string;
}

export interface RetrievalResult {
  documentId: string;
  packageId: string;
  score: number;
  snippet: string;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/u).filter(Boolean);
}

/** Lightweight local lexical retrieval for V2. It has no network dependency. */
export function retrieveLocal(query: string, documents: KnowledgeDocument[], limit = 5): RetrievalResult[] {
  const terms = new Set(tokenize(query));
  if (!terms.size) return [];

  return documents.map((doc) => {
    const words = tokenize(doc.text);
    const counts = new Map<string, number>();
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    let score = 0;
    for (const term of terms) score += counts.get(term) ?? 0;
    const index = Math.max(0, words.findIndex((word) => terms.has(word)));
    const snippet = words.slice(Math.max(0, index - 12), index + 48).join(' ');
    return { documentId: doc.id, packageId: doc.packageId, score, snippet };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildContext(results: RetrievalResult[]): string {
  return results.map((result, i) => `[${i + 1}] ${result.snippet}`).join('\n\n');
}
