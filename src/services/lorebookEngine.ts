import { db } from '../db';
import { LorebookRecord, LorebookEntryRecord } from '../types/lorebook';
import { estimateTokens } from './tokenEstimator';

export interface TriggeredLoreResult {
  triggeredEntries: LorebookEntryRecord[];
  injectedLoreText: string;
}

/**
 * Scans active lorebooks for keywords present in contextText.
 * Enforces selective keys, case sensitivity, priorities, and token budget.
 */
export async function scanLorebooksForTriggers(
  characterId: string | undefined,
  contextText: string,
  tokenBudget: number = 800
): Promise<TriggeredLoreResult> {
  const normalizedText = contextText.toLowerCase();

  // Find relevant lorebooks: specific to character or global (characterId is undefined)
  const lorebooks = await db.lorebooks
    .filter((lb: LorebookRecord) => !lb.characterId || lb.characterId === characterId)
    .toArray();

  if (lorebooks.length === 0) {
    return { triggeredEntries: [], injectedLoreText: '' };
  }

  const lorebookIds = lorebooks.map((lb) => lb.id);
  const allEntries = await db.lorebookEntries
    .where('lorebookId')
    .anyOf(lorebookIds)
    .and((e) => e.enabled)
    .toArray();

  const matchedEntries: LorebookEntryRecord[] = [];

  for (const entry of allEntries) {
    if (entry.constant) {
      matchedEntries.push(entry);
      continue;
    }

    const testText = entry.caseSensitive ? contextText : normalizedText;

    // Check primary keys
    const primaryMatch = entry.keys.some((rawKey) => {
      const key = entry.caseSensitive ? rawKey.trim() : rawKey.trim().toLowerCase();
      if (!key) return false;

      // Word boundary regex or direct substring match
      const escaped = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, entry.caseSensitive ? '' : 'i');
      return regex.test(testText) || testText.includes(key);
    });

    if (!primaryMatch) continue;

    // If secondary keys exist, check if at least one matches
    if (entry.secondaryKeys && entry.secondaryKeys.length > 0) {
      const secondaryMatch = entry.secondaryKeys.some((rawKey) => {
        const key = entry.caseSensitive ? rawKey.trim() : rawKey.trim().toLowerCase();
        if (!key) return false;
        return testText.includes(key);
      });
      if (!secondaryMatch) continue;
    }

    matchedEntries.push(entry);
  }

  // Sort by priority descending, then insertionOrder ascending
  matchedEntries.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.insertionOrder - b.insertionOrder;
  });

  // Apply token budget
  let currentTokens = 0;
  const budgetFiltered: LorebookEntryRecord[] = [];
  const loreSnippets: string[] = [];

  for (const entry of matchedEntries) {
    const tokens = estimateTokens(entry.content);
    if (currentTokens + tokens > tokenBudget && budgetFiltered.length > 0) {
      break; // stop when token budget is exceeded
    }
    currentTokens += tokens;
    budgetFiltered.push(entry);
    loreSnippets.push(`[LORE: ${entry.name}]\n${entry.content}`);
  }

  return {
    triggeredEntries: budgetFiltered,
    injectedLoreText: loreSnippets.join('\n\n'),
  };
}
