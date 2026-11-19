import { CharacterRecord } from '../types/characterCard';
import { PersonaRecord } from '../types/persona';
import { ChatSessionRecord, ChatMessageRecord } from '../types/chat';
import { LLMMessage, PromptInspectionData } from '../types/llm';
import { AppSettingsRecord } from '../types/settings';
import { applyMacrosToCard, substituteMacros } from './macroEngine';
import { scanLorebooksForTriggers } from './lorebookEngine';
import { estimateMessagesTokens } from './tokenEstimator';

export interface ContextAssemblyResult {
  dispatchedMessages: LLMMessage[];
  slidingWindowMessages: ChatMessageRecord[];
  hiddenCount: number;
  inspectionData: PromptInspectionData;
}

/**
 * Assembles Tier 1 (Sliding Window), Tier 2 (Rolling Summary), and Tier 3 (Pinned Facts + Lorebook)
 * into a cohesive, production-grade LLM message payload.
 */
export async function assemblePromptContext(params: {
  character: CharacterRecord;
  persona: PersonaRecord;
  session: ChatSessionRecord;
  allMessages: ChatMessageRecord[];
  draftUserText?: string;
  settings: AppSettingsRecord;
}): Promise<ContextAssemblyResult> {
  const { character, persona, session, allMessages, draftUserText = '', settings } = params;

  // 1. Resolve Character Card Macros
  const resolvedCard = applyMacrosToCard(character.data, persona);

  // 2. Scan Lorebooks for Keyword Triggers
  // Context to scan: user draft + latest 2 messages in chat
  const recentMessagesText = allMessages
    .slice(-2)
    .map((m) => m.content)
    .join(' ');
  const textToScan = `${draftUserText} ${recentMessagesText}`;
  const loreResult = await scanLorebooksForTriggers(character.id, textToScan, 750);

  // 3. Assemble System Prompt with Tier 2 (Summary) and Tier 3 (Pinned Memories & Lorebook)
  const systemSections: string[] = [];
  const directorRules: string[] = [];

  // Universal System Prompt (sent on every turn, cached by prompt cache)
  if (settings.universalSystemPrompt && settings.universalSystemPrompt.trim().length > 0) {
    systemSections.push(settings.universalSystemPrompt.trim());
    directorRules.push('Universal System Directives');
  }

  // Core Character Persona & Scenario
  systemSections.push(`You are ${resolvedCard.name}.\n\n[IDENTITY & BACKGROUND]\n${resolvedCard.description}`);
  
  if (resolvedCard.personality) {
    systemSections.push(`[PERSONALITY & MANNERISMS]\n${resolvedCard.personality}`);
  }

  if (resolvedCard.scenario) {
    systemSections.push(`[ACTIVE SCENARIO & SETTING]\n${resolvedCard.scenario}`);
  }

  // Protagonist Information
  systemSections.push(`[PROTAGONIST: ${persona.name} ({{user}})]
Gender: ${persona.gender || 'Unknown'}
Appearance & Attire: ${persona.physiqueAndApparel || 'Not specified'}
Traits: ${persona.psychologicalTraits || 'Not specified'}
Background: ${persona.backgroundLore || 'Not specified'}
${persona.lorebookMoveset ? `Abilities/Gear: ${persona.lorebookMoveset}` : ''}`);

  // Tier 3: Pinned Memories / Breakthroughs
  if (session.pinnedMemories && session.pinnedMemories.length > 0) {
    const pinnedText = session.pinnedMemories.map((m, idx) => `${idx + 1}. ${m}`).join('\n');
    systemSections.push(`[TIER 3: PINNED MEMORIES & MILESTONES (PERMANENT FACTS)]\n${pinnedText}`);
  }

  // Tier 2: Story Chronicles & Chapter Summaries (Compiled Historical Memory)
  if (session.chapters && session.chapters.length > 0) {
    const chaptersText = session.chapters
      .map((ch) => `[CHAPTER ${ch.chapterNumber}: ${ch.title} (Turns ${ch.startTurn}–${ch.endTurn})]\n${ch.summary}`)
      .join('\n\n');
    systemSections.push(`[STORY CHRONICLES & CHAPTER MEMORY (CANONICAL HISTORY)]
The following completed chapters record canonical events that transpired in earlier turns of this story. Maintain absolute narrative continuity with them:

${chaptersText}`);
  } else if (session.rollingSummary && session.rollingSummary.trim().length > 0) {
    systemSections.push(`[STORY CHRONICLES & NARRATIVE MEMORY (CANONICAL HISTORY)]\n${session.rollingSummary.trim()}`);
  }

  // Tier 3: Triggered Lorebook Entries
  if (loreResult.injectedLoreText) {
    systemSections.push(`[LOREBOOK ENTRIES]\n${loreResult.injectedLoreText}`);
  }

  // Character-specific System Prompt & Director Rules
  if (resolvedCard.system_prompt) {
    systemSections.push(`[CHARACTER INSTRUCTIONS]\n${resolvedCard.system_prompt}`);
    directorRules.push(resolvedCard.system_prompt);
  }

  // Dialogue Examples (mes_example)
  if (resolvedCard.mes_example && resolvedCard.mes_example.trim().length > 0) {
    systemSections.push(`[EXAMPLE DIALOGUE STYLE]\n${resolvedCard.mes_example.trim()}`);
  }

  // Final Assembled System Prompt
  const finalSystemPrompt = systemSections.join('\n\n');

  // 4. Tier 1: Sliding Window Context Assembly
  const maxUserTurns = settings.contextWindow.slidingWindowTurns || 10;

  // Count user turns from the end of allMessages
  let userTurnsSeen = 0;
  let sliceStartIndex = 0;

  for (let i = allMessages.length - 1; i >= 0; i--) {
    if (allMessages[i].role === 'user') {
      userTurnsSeen++;
      if (userTurnsSeen > maxUserTurns) {
        sliceStartIndex = i + 1;
        break;
      }
    }
  }

  // Active window messages
  const slidingWindowMessages = allMessages.slice(sliceStartIndex);
  const hiddenCount = sliceStartIndex;

  // Map to LLMMessage array
  const llmMessages: LLMMessage[] = [
    { role: 'system', content: finalSystemPrompt },
  ];

  // Append sliding window turns
  for (const msg of slidingWindowMessages) {
    // Skip empty or system messages
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;
    llmMessages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // If user has a current draft, append it as the final user message
  if (draftUserText && draftUserText.trim().length > 0) {
    llmMessages.push({
      role: 'user',
      content: draftUserText.trim(),
    });
  }

  // Post History Instructions anchor (if defined)
  if (resolvedCard.post_history_instructions) {
    const postHistoryText = substituteMacros(resolvedCard.post_history_instructions, {
      charName: resolvedCard.name,
      userName: persona.name,
    });
    llmMessages.push({
      role: 'system',
      content: `[DIRECTOR REMINDER: ${postHistoryText}]`,
    });
    directorRules.push(`Context Anchor: ${postHistoryText}`);
  }

  // Estimate total tokens
  const totalTokensEstimated = estimateMessagesTokens(llmMessages);

  // Prepare Diagnostics for Turn Prompt Inspector
  const inspectionData: PromptInspectionData = {
    systemPrompt: finalSystemPrompt,
    directorRules,
    pinnedMemories: session.pinnedMemories || [],
    rollingSummary: session.rollingSummary || '(None yet - early in roleplay)',
    activeWindowMessages: llmMessages,
    triggeredLore: loreResult.triggeredEntries.map((e) => ({
      name: e.name,
      keys: e.keys,
      content: e.content,
    })),
    totalTokensEstimated,
    rawPayload: {
      provider: settings.primaryModel.provider,
      model: settings.primaryModel.model,
      samplers: settings.samplers,
      messages: llmMessages,
    },
  };

  return {
    dispatchedMessages: llmMessages,
    slidingWindowMessages,
    hiddenCount,
    inspectionData,
  };
}
