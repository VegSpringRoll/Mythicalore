import { db } from '../db';
import { CharacterBook } from '../types/characterCard';
import { LorebookRecord, LorebookEntryRecord } from '../types/lorebook';

/**
 * Automatically parses and imports embedded character_book entries into IndexedDB lorebooks.
 */
export async function importEmbeddedCharacterBook(
  characterId: string, 
  characterName: string, 
  book?: CharacterBook
): Promise<string | null> {
  if (!book || !Array.isArray(book.entries) || book.entries.length === 0) {
    return null;
  }

  const lorebookId = `lorebook-${characterId}`;
  
  const record: LorebookRecord = {
    id: lorebookId,
    name: book.name || `${characterName}'s Lorebook`,
    description: book.description || `Embedded lorebook for ${characterName}`,
    characterId: characterId,
    scanDepth: typeof book.scan_depth === 'number' ? book.scan_depth : 5,
    tokenBudget: typeof book.token_budget === 'number' ? book.token_budget : 600,
    recursiveScanning: book.recursive_scanning ?? true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Upsert the lorebook container
  await db.lorebooks.put(record);

  // Delete previous entries for this lorebook to avoid duplicates
  await db.lorebookEntries.where('lorebookId').equals(lorebookId).delete();

  // Create entry records
  const entryRecords: LorebookEntryRecord[] = book.entries.map((entry, idx) => ({
    id: entry.id ? String(entry.id) : `entry-${characterId}-${idx}`,
    lorebookId,
    name: entry.name || entry.comment || `Entry ${idx + 1}`,
    keys: Array.isArray(entry.keys) ? entry.keys : [],
    secondaryKeys: Array.isArray(entry.secondary_keys) ? entry.secondary_keys : undefined,
    content: entry.content || '',
    enabled: entry.enabled ?? true,
    priority: typeof entry.priority === 'number' ? entry.priority : 10,
    insertionOrder: typeof entry.insertion_order === 'number' ? entry.insertion_order : idx,
    caseSensitive: entry.case_sensitive ?? false,
    constant: entry.constant ?? false,
  }));

  await db.lorebookEntries.bulkPut(entryRecords);
  return lorebookId;
}
