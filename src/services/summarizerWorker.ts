import { db } from '../db';
import { CharacterRecord } from '../types/characterCard';
import { PersonaRecord } from '../types/persona';
import { ChatSessionRecord, ChatMessageRecord, ChapterRecord } from '../types/chat';
import { AppSettingsRecord } from '../types/settings';
import { requestBackgroundSummary } from './llmClient';

let isSummarizing = false;

/**
 * Generates a structured Chapter summary for the session.
 * For example: Turns 1-10 -> Chapter 1, Turns 11-20 -> Chapter 2, etc.
 * Can be triggered automatically or manually from the World State & Chronicle panel.
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

  const interval = session.chapterTurnInterval || settings.contextWindow.chapterTurnInterval || 10;
  
  // Count user turns
  const userMessages = allMessages.filter((m) => m.role === 'user');
  const totalUserTurns = userMessages.length;

  const existingChapters = session.chapters || [];
  const nextChapterNumber = existingChapters.length + 1;
  const startTurnIndex = existingChapters.length * interval;

  // If not forced, require at least interval turns to form a new chapter
  if (!force && totalUserTurns < nextChapterNumber * interval) {
    return null;
  }

  // Find the slice of messages covering this chapter
  // (from the (startTurnIndex)-th user turn onwards)
  let userTurnsSeen = 0;
  let startMsgIdx = 0;
  for (let i = 0; i < allMessages.length; i++) {
    if (allMessages[i].role === 'user') {
      if (userTurnsSeen === startTurnIndex) {
        startMsgIdx = i;
        break;
      }
      userTurnsSeen++;
    }
  }

  // Chapter ends either at (nextChapterNumber * interval) turns or at the end of messages if forced
  const chapterMessages = allMessages.slice(startMsgIdx);
  if (chapterMessages.length < 2) return null;

  const chapterTurnsText = chapterMessages
    .map((m) => `${m.role === 'user' ? persona.name : character.name}: ${m.content}`)
    .join('\n\n');

  isSummarizing = true;
  try {
    // Determine which summarizer model profile to use
    // Must strictly have an active model configured in Background Summarizer BYOK!
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

    const promptText = `Produce Chapter ${nextChapterNumber} summary for this roleplay campaign.
Format your output EXACTLY as:
TITLE: <Vivid Chapter Title, 3-6 words>
SUMMARY: <Cohesive, literature-grade third-person narrative chronicle of key revelations, character dynamics, battles, emotional milestones, and world state shifts from these turns in 2-3 paragraphs>`;

    const responseText = await requestBackgroundSummary({
      provider,
      model,
      existingSummary: previousChaptersSummary,
      turnsToSummarize: `${promptText}\n\nTURNS FOR CHAPTER ${nextChapterNumber}:\n${chapterTurnsText}`,
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
      startTurn: startTurnIndex + 1,
      endTurn: totalUserTurns,
      summary: chapterSummary,
      createdAt: Date.now(),
    };

    const updatedChapters = [...existingChapters, newChapter];

    // Also update rolling summary to include this chapter
    const updatedRolling = updatedChapters
      .map((c) => `[CHAPTER ${c.chapterNumber}: ${c.title}]\n${c.summary}`)
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

  if (!settings.contextWindow.autoTriggerSummary) return;

  try {
    const newChapter = await generateChapterSummary({
      session,
      character,
      persona,
      allMessages,
      settings,
      force: false,
    });

    if (newChapter && onSummaryUpdated) {
      const updatedChapters = [...(session.chapters || []), newChapter];
      const updatedRolling = updatedChapters
        .map((c) => `[CHAPTER ${c.chapterNumber}: ${c.title}]\n${c.summary}`)
        .join('\n\n');

      onSummaryUpdated({
        chapters: updatedChapters,
        rollingSummary: updatedRolling,
      });
    }
  } catch (err: any) {
    console.warn('[Chapter Summarizer] Error in checkAndTriggerRollingSummary:', err);
    if (onError) onError(err instanceof Error ? err : new Error(String(err)));
  }
}
