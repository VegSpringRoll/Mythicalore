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

  // Protagonist Movesets & Abilities (Lorebook-style trigger scanner)
  if (persona.moves && persona.moves.length > 0) {
    const activeMoves = persona.moves.filter((m) => m.enabled !== false);
    const triggeredMoves = activeMoves.filter((move) => {
      if (!move.triggers || move.triggers.length === 0) return true;
      const lowerContext = textToScan.toLowerCase();
      return move.triggers.some((tr) => {
        const clean = tr.trim().toLowerCase();
        if (!clean) return false;
        return lowerContext.includes(clean);
      });
    });

    if (triggeredMoves.length > 0) {
      const movesFormatted = triggeredMoves
        .map((m) => `• [PROTAGONIST TECHNIQUE: ${m.name}] (Triggers: ${m.triggers.join(', ')})\n${m.description}`)
        .join('\n\n');
      systemSections.push(`[PROTAGONIST ACTIVE MOVESETS & TRIGGERED ABILITIES]\n${movesFormatted}`);
      directorRules.push('Protagonist Movesets Injected');
    }
  }

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

  // Director Rule for Scene Telemetry & Atmosphere State
  systemSections.push(`[DIRECTOR TELEMETRY: SCENE ATMOSPHERE & STATE]
At the very end of your response, after all prose and dialogue, output a scene telemetry state block representing the updated scene situation:
\`\`\`state
{
  "time": "${session.worldState?.time || 'Midnight (23:45)'}",
  "date": "${session.worldState?.date || 'Day 14, Lunar Eclipse'}",
  "weather": "${session.worldState?.weather || 'Clear Night'}",
  "location": "${session.worldState?.location || 'Sanctum'}",
  "activeNpcs": ${JSON.stringify(session.worldState?.activeNpcs || [character.name])},
  "mood": "${session.worldState?.mood || 'Mysterious'}"
}
\`\`\``);

  // Final Assembled System Prompt
  const finalSystemPrompt = systemSections.join('\n\n');

  // 4. Tier 1: Sliding Window Context Assembly
  // Only the chosen amount of last N user turns + corresponding assistant replies are sent to the AI.
  // Older turns are digested and injected exclusively via Tier 2 Story Chronicles / Summaries.
  const maxUserTurns = (session as any)?.slidingWindowTurns || settings.contextWindow?.slidingWindowTurns || 10;

  // Find all indices of user messages
  const userIndices: number[] = [];
  for (let i = 0; i < allMessages.length; i++) {
    if (allMessages[i].role === 'user') {
      userIndices.push(i);
    }
  }

  let sliceStartIndex = 0;
  if (userIndices.length > maxUserTurns) {
    // Start strictly at the first user turn of the last maxUserTurns window
    sliceStartIndex = userIndices[userIndices.length - maxUserTurns];
  }

  // Active window messages containing ONLY the last N user turns
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
