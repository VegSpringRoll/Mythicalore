import { db } from '../db';
import { CharacterRecord } from '../types/characterCard';
import { PersonaRecord } from '../types/persona';
import { ChatSessionRecord, ChatMessageRecord, ChapterRecord } from '../types/chat';
import { AppSettingsRecord } from '../types/settings';
import { requestBackgroundSummary } from './llmClient';

let isSummarizing = false;

/**
 * Generates a structured Chapter summary for the session.
 * Each chapter covers ONLY its own slice of N turns (e.g. Turns 1-10 -> Chapter 1, Turns 11-20 -> Chapter 2).
 * Completed chapters are compiled one after another.
 */
export async function generateChapterSummary(params: {
  session: ChatSessionRecord;
  character: CharacterRecord;
  persona: PersonaRecord;
  allMessages: ChatMessageRecord[];
  settings: AppSettingsRecord;
  force?: boolean;
}): Promise<ChapterRecord | null> {
  const { session, character, persona, allMessages, settings, force = false } = params;

  if (isSummarizing) return null;

  const interval = session.chapterTurnInterval || settings.contextWindow?.chapterTurnInterval || 10;
  
  // Collect all user messages and their indices
  const userMessageIndices: number[] = [];
  for (let i = 0; i < allMessages.length; i++) {
    if (allMessages[i].role === 'user') {
      userMessageIndices.push(i);
    }
  }

  const totalUserTurns = userMessageIndices.length;
  const existingChapters = session.chapters || [];
  const nextChapterNumber = existingChapters.length + 1;

  // The 0-based user turn index range for this chapter:
  // e.g. for Chapter 1 with interval 10: turns 0 to 9 (1st to 10th user turn)
  // for Chapter 2: turns 10 to 19 (11th to 20th user turn)
  const startUserTurnIndex = existingChapters.length * interval;
  const targetEndUserTurnIndex = nextChapterNumber * interval - 1;

  // If not forced, require at least targetEndUserTurnIndex user turns to be reached
  if (!force && totalUserTurns < nextChapterNumber * interval) {
    return null;
  }

  if (startUserTurnIndex >= totalUserTurns) {
    return null; // All user turns already summarized into chapters
  }

  // End turn index for this chapter: capped strictly at targetEndUserTurnIndex (or totalUserTurns - 1 if forced)
  const endUserTurnIndex = force 
    ? Math.min(totalUserTurns - 1, targetEndUserTurnIndex)
    : targetEndUserTurnIndex;

  // Determine message slice in allMessages for THIS CHAPTER ONLY
  // If Chapter 1: start from message 0 to capture initial character scene setting / greeting
  // Subsequent chapters: start from the first user message of that chapter
  const startMsgIdx = nextChapterNumber === 1 ? 0 : userMessageIndices[startUserTurnIndex];

  // End message index: up through the assistant response to the endUserTurn
  let endMsgIdx = allMessages.length;
  if (endUserTurnIndex + 1 < userMessageIndices.length) {
    // There is a subsequent user turn; the slice ends where the NEXT user turn starts
    endMsgIdx = userMessageIndices[endUserTurnIndex + 1];
  }

  const chapterMessages = allMessages.slice(startMsgIdx, endMsgIdx);
  if (chapterMessages.length < 2) return null;

  const chapterTurnsText = chapterMessages
    .map((m) => `${m.role === 'user' ? persona.name : character.name}: ${m.content}`)
    .join('\n\n');

  isSummarizing = true;
  try {
    // Determine which summarizer model profile to use
    // Must strictly have an active model configured in Summary Model!
    const activeProfile = settings.summarizerProfiles.find((p) => p.id === settings.summarizerModel.profileId)
      || (settings.summarizerProfiles.length > 0 ? settings.summarizerProfiles[0] : null);

    if (!activeProfile || !activeProfile.model || (!activeProfile.apiKey && activeProfile.provider !== 'custom')) {
      throw new Error('Please connect Summarizer Model');
    }

    const provider = activeProfile.provider;
    const model = activeProfile.model;
    const apiKey = activeProfile.apiKey;
    const baseUrl = activeProfile.baseUrl || settings.summarizerModel.customUrl;

    const previousChaptersSummary = existingChapters
      .map((c) => `Chapter ${c.chapterNumber} (${c.title}): ${c.summary}`)
      .join('\n\n');

    const promptText = `Summarize Chapter ${nextChapterNumber} (User Turns ${startUserTurnIndex + 1}–${endUserTurnIndex + 1}) for this ongoing roleplay chronicle.
Format your output EXACTLY as:
TITLE: <Vivid Chapter Title, 3-6 words>
SUMMARY: <Cohesive, literature-grade third-person narrative chronicle of key revelations, character dynamics, battles, emotional milestones, and world state shifts that happened in THESE SPECIFIC TURNS in 2-3 dense paragraphs. Do NOT re-summarize past chapters.>`;

    const responseText = await requestBackgroundSummary({
      provider,
      model,
      existingSummary: previousChaptersSummary,
      turnsToSummarize: `${promptText}\n\nTURNS FOR CHAPTER ${nextChapterNumber} (TURNS ${startUserTurnIndex + 1} TO ${endUserTurnIndex + 1}):\n${chapterTurnsText}`,
      characterName: character.name,
      personaName: persona.name,
      apiKey,
      baseUrl,
    });

    let chapterTitle = `Chapter ${nextChapterNumber}`;
    let chapterSummary = responseText.trim();

    const titleMatch = responseText.match(/TITLE:\s*([^\n]+)/i);
    if (titleMatch) {
      chapterTitle = titleMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    const summaryMatch = responseText.match(/SUMMARY:\s*([\s\S]+)/i);
    if (summaryMatch) {
      chapterSummary = summaryMatch[1].trim();
    } else if (titleMatch) {
      chapterSummary = responseText.replace(/TITLE:[^\n]+\n*/i, '').trim();
    }

    const newChapter: ChapterRecord = {
      chapterNumber: nextChapterNumber,
      title: chapterTitle,
      startTurn: startUserTurnIndex + 1,
      endTurn: endUserTurnIndex + 1,
      summary: chapterSummary,
      createdAt: Date.now(),
    };

    const updatedChapters = [...existingChapters, newChapter];

    // Compile chapters one after another
    const updatedRolling = updatedChapters
      .map((c) => `[CHAPTER ${c.chapterNumber}: ${c.title} (Turns ${c.startTurn}–${c.endTurn})]\n${c.summary}`)
      .join('\n\n');

    await db.sessions.update(session.id, {
      chapters: updatedChapters,
      rollingSummary: updatedRolling,
      updatedAt: Date.now(),
    });

    return newChapter;
  } catch (err) {
    console.warn('[Chapter Summarizer] Failed to generate chapter summary:', err);
    throw err;
  } finally {
    isSummarizing = false;
  }
}

/**
 * Checks if the message count warrants a rolling summary / chapter update,
 * and asynchronously triggers the Background Summarizer Model.
 * Automatically catches up on all pending chapters if multiple intervals have passed.
 */
export async function checkAndTriggerRollingSummary(params: {
  session: ChatSessionRecord;
  character: CharacterRecord;
  persona: PersonaRecord;
  allMessages: ChatMessageRecord[];
  settings: AppSettingsRecord;
  onSummaryUpdated?: (updatedSession: Partial<ChatSessionRecord>) => void;
  onError?: (err: Error) => void;
}): Promise<void> {
  const { session, character, persona, allMessages, settings, onSummaryUpdated, onError } = params;

  // Auto-trigger is enabled by default unless explicitly set to false
  if (settings.contextWindow?.autoTriggerSummary === false) return;

  try {
    const userMessageCount = allMessages.filter((m) => m.role === 'user').length;
    const interval = session.chapterTurnInterval || settings.contextWindow?.chapterTurnInterval || 10;
    
    let currentChapters = [...(session.chapters || [])];
    let hasUpdated = false;

    // Loop to catch up all pending chapters (e.g. at 12 turns with interval 10 -> Chapter 1; at 25 turns -> Chapter 1 then 2)
    while (userMessageCount >= (currentChapters.length + 1) * interval) {
      const workingSession: ChatSessionRecord = {
        ...session,
        chapters: currentChapters,
      };

      const newChapter = await generateChapterSummary({
        session: workingSession,
        character,
        persona,
        allMessages,
        settings,
        force: false,
      });

      if (!newChapter) break;

      currentChapters.push(newChapter);
      hasUpdated = true;
    }

    if (hasUpdated && onSummaryUpdated) {
      const updatedRolling = currentChapters
        .map((c) => `[CHAPTER ${c.chapterNumber}: ${c.title} (Turns ${c.startTurn}–${c.endTurn})]\n${c.summary}`)
        .join('\n\n');

      onSummaryUpdated({
        chapters: currentChapters,
        rollingSummary: updatedRolling,
      });
    }
  } catch (err: any) {
    console.warn('[Chapter Summarizer] Error in checkAndTriggerRollingSummary:', err);
    if (onError) onError(err instanceof Error ? err : new Error(String(err)));
  }
}
