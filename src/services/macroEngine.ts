import { CharacterCardV2Data } from '../types/characterCard';
import { PersonaRecord } from '../types/persona';

export interface MacroContext {
  charName: string;
  userName: string;
  scenario?: string;
  personaLore?: string;
}

/**
 * Replaces all macro tokens like {{char}} and {{user}} in a given string.
 */
export function substituteMacros(text: string, context: MacroContext): string {
  if (!text) return '';

  const { charName, userName, scenario = '', personaLore = '' } = context;

  return text
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{char_name\}\}/gi, charName)
    .replace(/<BOT>/gi, charName)
    .replace(/\{\{user\}\}/gi, userName)
    .replace(/\{\{user_name\}\}/gi, userName)
    .replace(/<USER>/gi, userName)
    .replace(/\{\{scenario\}\}/gi, scenario)
    .replace(/\{\{persona\}\}/gi, personaLore);
}

/**
 * Performs macro substitution on an entire CharacterCardV2Data object.
 */
export function applyMacrosToCard(cardData: CharacterCardV2Data, persona: PersonaRecord): CharacterCardV2Data {
  const context: MacroContext = {
    charName: cardData.name,
    userName: persona.name,
    scenario: cardData.scenario,
    personaLore: `${persona.backgroundLore} ${persona.physiqueAndApparel} ${persona.psychologicalTraits}`,
  };

  return {
    ...cardData,
    description: substituteMacros(cardData.description, context),
    personality: substituteMacros(cardData.personality, context),
    scenario: substituteMacros(cardData.scenario, context),
    first_mes: substituteMacros(cardData.first_mes, context),
    mes_example: substituteMacros(cardData.mes_example, context),
    system_prompt: cardData.system_prompt ? substituteMacros(cardData.system_prompt, context) : undefined,
    post_history_instructions: cardData.post_history_instructions 
      ? substituteMacros(cardData.post_history_instructions, context) 
      : undefined,
  };
}
