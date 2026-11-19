import { LLMMessage } from '../types/llm';

/**
 * Estimates token count for a text string.
 * Uses a weighted subword/character heuristic calibrated for LLM BPE tokenizers.
 * (Averages ~3.8 to 4.0 characters per token for English prose & dialogue).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;

  // Approximate words and punctuation
  const words = trimmed.split(/\s+/).length;
  const chars = trimmed.length;

  // Hybrid formula: weighted average of word count * 1.33 and char count / 3.8
  const fromWords = words * 1.33;
  const fromChars = chars / 3.8;
  return Math.max(1, Math.round((fromWords + fromChars) / 2));
}

/**
 * Estimates total tokens for an array of LLM messages.
 */
export function estimateMessagesTokens(messages: LLMMessage[]): number {
  let total = 0;
  for (const m of messages) {
    total += 4; // per-message envelope overhead (<|im_start|>, role, etc.)
    total += estimateTokens(m.content);
  }
  total += 3; // assistant prime overhead
  return total;
}
