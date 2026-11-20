export type ContentTokenType = 'narration' | 'dialogue' | 'thought' | 'ooc';

export interface InlineToken {
  type: ContentTokenType;
  text: string;
}

export interface ParagraphBlock {
  tokens: InlineToken[];
}

// Backward compatibility interface
export interface ParsedBlock {
  type: 'narration' | 'dialogue' | 'thought' | 'ooc' | 'prose';
  text: string;
}

export interface ExtractedRoleplayState {
  time?: string;
  date?: string;
  location?: string;
  atmosphere?: string;
  weather?: string;
  activeNpcs?: string[];
  mood?: string;
  notes?: string;
}

/**
 * Extracts and removes hidden state blocks returned by the AI:
 * e.g. ```state { "time": "...", "weather": "Rain", "mood": "Tense Combat" } ```
 * or <!--STATE: { ... } -->
 */
export function extractRoleplayState(rawText: string): { cleanedText: string; state: ExtractedRoleplayState | null } {
  if (!rawText) return { cleanedText: '', state: null };

  let state: ExtractedRoleplayState | null = null;
  let cleaned = rawText;

  // 1. Look for ```state ... ``` or ```json:state ... ```
  const codeBlockRegex = /```(?:state|json:state)\s*([\s\S]*?)```/i;
  const codeMatch = cleaned.match(codeBlockRegex);
  if (codeMatch) {
    try {
      state = JSON.parse(codeMatch[1].trim());
    } catch {
      // Try relaxed JSON parsing if keys aren't quoted
      try {
        const relaxed = codeMatch[1].replace(/(\w+):/g, '"$1":');
        state = JSON.parse(relaxed);
      } catch {}
    }
    cleaned = cleaned.replace(codeBlockRegex, '').trim();
  }

  // 2. Look for <!--STATE: ... -->
  if (!state) {
    const commentRegex = /<!--(?:STATE|SCENE_STATE):?\s*([\s\S]*?)-->/i;
    const commentMatch = cleaned.match(commentRegex);
    if (commentMatch) {
      try {
        state = JSON.parse(commentMatch[1].trim());
      } catch {}
      cleaned = cleaned.replace(commentRegex, '').trim();
    }
  }

  // 3. Look for <state>...</state> or <state_update>...</state_update>
  if (!state) {
    const tagRegex = /<(?:state_update|state)>([\s\S]*?)<\/(?:state_update|state)>/i;
    const tagMatch = cleaned.match(tagRegex);
    if (tagMatch) {
      try {
        state = JSON.parse(tagMatch[1].trim());
      } catch {}
      cleaned = cleaned.replace(tagRegex, '').trim();
    }
  }

  return { cleanedText: cleaned, state };
}

/**
 * Cleans any boundary asterisks (*) that hug dialogue quotation marks.
 * e.g. *"Hello"* -> "Hello", *“Hello”* -> “Hello”
 */
export function sanitizeDialogueAsterisks(text: string): string {
  if (!text) return '';
  return text
    // Strip asterisks directly touching outside quotation marks: *"..."* or *“...”*
    .replace(/\*+([“"「])/g, '$1')
    .replace(/([”"」])\*+/g, '$1');
}

/**
 * Parses raw roleplay text into paragraphs with structured inline tokens:
 * - Dialogue: Spoken dialogue in quotation marks ("..." / “...” / 「...」) -> colorful glowing text
 * - Thought: Internal monologues (*...*) -> clean italics without literal asterisks
 * - Narration: Actions and environmental prose -> simple text
 * - OOC: (OOC: ...) director steering instructions
 */
export function parseRoleplayParagraphs(rawText: string): ParagraphBlock[] {
  if (!rawText) return [];

  // Strip hidden state block so technical JSON never leaks into reading cards
  const { cleanedText: textWithoutState } = extractRoleplayState(rawText);

  // Pre-clean any boundary asterisks around dialogues
  const cleanedText = sanitizeDialogueAsterisks(textWithoutState);
  const rawParagraphs = cleanedText.split(/\r?\n+/);
  const result: ParagraphBlock[] = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Check for explicit XML tags (<say>, <thought>, <narration>, <state_update>)
    if (/<(narration|say|thought|state_update)>/i.test(trimmed)) {
      const tokens: InlineToken[] = [];
      const tagRegex = /<(narration|say|thought|state_update)>([\s\S]*?)(?:<\/\1>|$)/gi;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = tagRegex.exec(trimmed)) !== null) {
        if (match.index > lastIndex) {
          const pre = trimmed.slice(lastIndex, match.index).trim();
          if (pre) tokens.push({ type: 'narration', text: pre });
        }

        const tag = match[1].toLowerCase();
        let content = match[2].trim();
        // Remove any inner asterisks from dialogue tag content
        if (tag === 'say') {
          content = content.replace(/^\*+|\*+$/g, '').trim();
          if (content) tokens.push({ type: 'dialogue', text: content });
        } else if (tag === 'thought') {
          content = content.replace(/^\*+|\*+$/g, '').trim();
          if (content) tokens.push({ type: 'thought', text: content });
        } else if (tag === 'state_update') {
          if (content) tokens.push({ type: 'ooc', text: content });
        } else {
          if (content) tokens.push({ type: 'narration', text: content });
        }
        lastIndex = tagRegex.lastIndex;
      }

      if (lastIndex < trimmed.length) {
        const post = trimmed.slice(lastIndex).trim();
        if (post) tokens.push({ type: 'narration', text: post });
      }

      if (tokens.length > 0) {
        result.push({ tokens });
        continue;
      }
    }

    // Direct whole-paragraph OOC
    if (/^\(OOC:[\s\S]*\)$/i.test(trimmed)) {
      result.push({ tokens: [{ type: 'ooc', text: trimmed }] });
      continue;
    }

    // Conventional tokenizer: match dialogue ("..."), thoughts/actions in asterisks (*...*), or (OOC: ...)
    const tokenRegex = /(\(OOC:[\s\S]*?\))|([“"「][^”"」]+[”"」])|(\*[^*]+\*)/g;
    const tokens: InlineToken[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(trimmed)) !== null) {
      if (match.index > lastIndex) {
        const plainText = trimmed.slice(lastIndex, match.index);
        // Clean out any stray asterisk remnants left by broken boundary patterns
        const cleanedPlain = plainText.replace(/^\s*\*+\s*$/, '').trim();
        if (cleanedPlain.length > 0) {
          tokens.push({ type: 'narration', text: cleanedPlain });
        }
      }

      if (match[1]) {
        // OOC
        tokens.push({ type: 'ooc', text: match[1] });
      } else if (match[2]) {
        // Dialogue in quotation marks
        const rawQuote = match[2];
        let inner = rawQuote.replace(/^[“"「]|[”"」]$/g, '').trim();
        // Strip any residual asterisks from the boundary of the dialogue
        inner = inner.replace(/^\*+|\*+$/g, '').trim();
        if (inner) {
          tokens.push({ type: 'dialogue', text: inner });
        }
      } else if (match[3]) {
        // Internal monologue in asterisks
        const rawAsterisk = match[3];
        const inner = rawAsterisk.replace(/^\*+|\*+$/g, '').trim();
        if (inner) {
          tokens.push({ type: 'thought', text: inner });
        }
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < trimmed.length) {
      const remaining = trimmed.slice(lastIndex);
      const cleanedRemaining = remaining.replace(/^\s*\*+\s*$/, '').trim();
      if (cleanedRemaining.length > 0) {
        tokens.push({ type: 'narration', text: cleanedRemaining });
      }
    }

    if (tokens.length > 0) {
      result.push({ tokens });
    } else {
      result.push({ tokens: [{ type: 'narration', text: trimmed }] });
    }
  }

  return result;
}

/**
 * Legacy flat block parser for backward compatibility
 */
export function parseRoleplayContent(rawText: string): ParsedBlock[] {
  const paragraphs = parseRoleplayParagraphs(rawText);
  const flat: ParsedBlock[] = [];
  for (const p of paragraphs) {
    for (const t of p.tokens) {
      flat.push({
        type: t.type === 'narration' ? 'prose' : t.type,
        text: t.text,
      });
    }
  }
  return flat.length > 0 ? flat : [{ type: 'prose', text: rawText }];
}
