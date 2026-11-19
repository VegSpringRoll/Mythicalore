import { db } from '../db';

/**
 * Converts a Blob to a base64 Data URL.
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a base64 Data URL to a Blob.
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export interface WorkspaceExportData {
  version: number;
  timestamp: number;
  characters: unknown[];
  personas: unknown[];
  sessions: unknown[];
  messages: unknown[];
  lorebooks: unknown[];
  lorebookEntries: unknown[];
  settings: unknown[];
}

/**
 * Exports all IndexedDB tables into a clean JSON bundle.
 */
export async function exportWorkspaceJson(): Promise<Blob> {
  const rawCharacters = await db.characters.toArray();
  const serializedCharacters = [];

  for (const c of rawCharacters) {
    let avatarBase64: string | undefined = undefined;
    if (c.avatarBlob) {
      try {
        avatarBase64 = await blobToDataUrl(c.avatarBlob);
      } catch (e) {
        console.warn('Failed to convert avatar blob for export:', e);
      }
    }
    serializedCharacters.push({
      ...c,
      avatarBlob: undefined, // strip raw Blob
      avatarBase64,
    });
  }

  const rawPersonas = await db.personas.toArray();
  const serializedPersonas = [];
  for (const p of rawPersonas) {
    let avatarBase64: string | undefined = undefined;
    if (p.avatarBlob) {
      try {
        avatarBase64 = await blobToDataUrl(p.avatarBlob);
      } catch (e) {
        console.warn('Failed to convert persona avatar blob for export:', e);
      }
    }
    serializedPersonas.push({
      ...p,
      avatarBlob: undefined,
      avatarBase64,
    });
  }

  const exportPayload: WorkspaceExportData = {
    version: 1,
    timestamp: Date.now(),
    characters: serializedCharacters,
    personas: serializedPersonas,
    sessions: await db.sessions.toArray(),
    messages: await db.messages.toArray(),
    lorebooks: await db.lorebooks.toArray(),
    lorebookEntries: await db.lorebookEntries.toArray(),
    settings: await db.settings.toArray(),
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  return new Blob([jsonStr], { type: 'application/json' });
}

/**
 * Imports a workspace JSON bundle into IndexedDB.
 */
export async function importWorkspaceJson(file: File | Blob): Promise<void> {
  const text = await file.text();
  const data: WorkspaceExportData = JSON.parse(text);

  if (!data.characters || !data.personas) {
    throw new Error('Invalid workspace backup format.');
  }

  // Restore characters with avatar blobs
  const restoredCharacters = [];
  for (const c of (data.characters as any[])) {
    let blob: Blob | undefined = undefined;
    const base64 = c.avatarBase64 as string | undefined;
    if (base64) {
      try {
        blob = await dataUrlToBlob(base64);
      } catch (e) {
        console.warn('Failed to restore avatar blob:', e);
      }
    }
    restoredCharacters.push({
      ...c,
      avatarBlob: blob,
      avatarUrl: blob ? URL.createObjectURL(blob) : (c.avatarUrl as string | undefined),
    });
  }

  // Restore personas with avatar blobs
  const restoredPersonas = [];
  for (const p of (data.personas as any[])) {
    let blob: Blob | undefined = undefined;
    const base64 = p.avatarBase64 as string | undefined;
    if (base64) {
      try {
        blob = await dataUrlToBlob(base64);
      } catch (e) {
        console.warn('Failed to restore persona avatar blob:', e);
      }
    }
    restoredPersonas.push({
      ...p,
      avatarBlob: blob,
      avatarUrl: blob ? URL.createObjectURL(blob) : (p.avatarUrl as string | undefined),
    });
  }

  // Bulk put into Dexie
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.characters.bulkPut(restoredCharacters as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.personas.bulkPut(restoredPersonas as any);
  if (data.sessions?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.sessions.bulkPut(data.sessions as any);
  }
  if (data.messages?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.messages.bulkPut(data.messages as any);
  }
  if (data.lorebooks?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.lorebooks.bulkPut(data.lorebooks as any);
  }
  if (data.lorebookEntries?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.lorebookEntries.bulkPut(data.lorebookEntries as any);
  }
  if (data.settings?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.settings.bulkPut(data.settings as any);
  }
}
