import { PhoneticRule } from '../types';

export const DEFAULT_PHONETIC_RULES: PhoneticRule[] = [
  {
    id: 'rule-jcod',
    target: 'jcod',
    replacement: 'jay-cod',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Acronym',
    description: 'Normalizes jcod / JCOD acronym to natural speech "jay-cod" / "Jay-Cod"',
    enabled: true,
  },
  {
    id: 'rule-api',
    target: 'API',
    replacement: 'A-P-I',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Acronym',
    description: 'Spells out API letters individually',
    enabled: true,
  },
  {
    id: 'rule-tts',
    target: 'TTS',
    replacement: 'T-T-S',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Acronym',
    description: 'Spells out Text-To-Speech as T-T-S',
    enabled: true,
  },
  {
    id: 'rule-sql',
    target: 'SQL',
    replacement: 'sequel',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Technical',
    description: 'Pronounces SQL as "sequel"',
    enabled: true,
  },
  {
    id: 'rule-saas',
    target: 'SaaS',
    replacement: 'sass',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Acronym',
    description: 'Pronounces SaaS as "sass"',
    enabled: true,
  },
  {
    id: 'rule-ivr',
    target: 'IVR',
    replacement: 'I-V-R',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Technical',
    description: 'Interactive Voice Response spelled out as I-V-R',
    enabled: true,
  },
  {
    id: 'rule-pbx',
    target: 'PBX',
    replacement: 'P-B-X',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Technical',
    description: 'Private Branch Exchange telephony acronym',
    enabled: true,
  },
  {
    id: 'rule-voip',
    target: 'VoIP',
    replacement: 'voyp',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Technical',
    description: 'Voice over IP pronounced as "voyp"',
    enabled: true,
  },
  {
    id: 'rule-khz',
    target: 'kHz',
    replacement: 'kilo-hertz',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Technical',
    description: 'Expands kHz unit to kilo-hertz',
    enabled: true,
  },
  {
    id: 'rule-hz',
    target: 'Hz',
    replacement: 'hertz',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Technical',
    description: 'Expands Hz unit to hertz',
    enabled: true,
  },
  {
    id: 'rule-sdk',
    target: 'SDK',
    replacement: 'S-D-K',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Acronym',
    description: 'Software Development Kit spelled out as S-D-K',
    enabled: true,
  },
  {
    id: 'rule-faq',
    target: 'FAQ',
    replacement: 'eff-ay-cue',
    caseSensitive: false,
    matchWholeWord: true,
    category: 'Acronym',
    description: 'Frequently Asked Questions spelled out phonetically',
    enabled: true,
  },
];

/**
 * Case-preserving heuristic:
 * - If original was all uppercase (e.g. "JCOD"), output title/capitalized or upper formatted (e.g. "Jay-Cod" or "JAY-COD")
 * - If original was titlecase (e.g. "Jcod"), output titlecase (e.g. "Jay-Cod")
 * - If original was lowercase (e.g. "jcod"), output lowercase (e.g. "jay-cod")
 */
function preserveCaseHeuristic(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    // Uppercase
    if (replacement.includes('-')) {
      return replacement
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('-');
    }
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  if (original.charAt(0) === original.charAt(0).toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    // Title case
    if (replacement.includes('-')) {
      return replacement
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('-');
    }
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  if (original === original.toLowerCase()) {
    return replacement.toLowerCase();
  }
  return replacement;
}

export interface PhoneticMatch {
  ruleId: string;
  matchedText: string;
  replacementText: string;
  startIndex: number;
  endIndex: number;
}

export function detectPhoneticMatches(text: string, rules: PhoneticRule[]): PhoneticMatch[] {
  if (!text) return [];
  const matches: PhoneticMatch[] = [];
  const activeRules = rules.filter((r) => r.enabled && r.target.trim().length > 0);

  for (const rule of activeRules) {
    const escaped = rule.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = rule.matchWholeWord ? `\\b${escaped}\\b` : escaped;
    const flags = rule.caseSensitive ? 'g' : 'gi';

    try {
      const regex = new RegExp(pattern, flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[0];
        const replacementText = rule.caseSensitive
          ? rule.replacement
          : preserveCaseHeuristic(matchedText, rule.replacement);
        matches.push({
          ruleId: rule.id,
          matchedText,
          replacementText,
          startIndex: match.index,
          endIndex: match.index + matchedText.length,
        });
      }
    } catch {
      // Ignore invalid regex
    }
  }

  // Sort by starting index
  return matches.sort((a, b) => a.startIndex - b.startIndex);
}

export function applyPhoneticReplacements(
  text: string,
  rules: PhoneticRule[],
): { transformedText: string; appliedCount: number; appliedRules: { original: string; replacedWith: string }[] } {
  if (!text) return { transformedText: '', appliedCount: 0, appliedRules: [] };

  let result = text;
  let appliedCount = 0;
  const appliedRules: { original: string; replacedWith: string }[] = [];
  const activeRules = rules.filter((r) => r.enabled && r.target.trim().length > 0);

  for (const rule of activeRules) {
    const escaped = rule.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = rule.matchWholeWord ? `\\b${escaped}\\b` : escaped;
    const flags = rule.caseSensitive ? 'g' : 'gi';

    try {
      const regex = new RegExp(pattern, flags);
      result = result.replace(regex, (matched) => {
        appliedCount++;
        const replacement = rule.caseSensitive
          ? rule.replacement
          : preserveCaseHeuristic(matched, rule.replacement);
        appliedRules.push({ original: matched, replacedWith: replacement });
        return replacement;
      });
    } catch {
      // Ignore invalid regex
    }
  }

  return { transformedText: result, appliedCount, appliedRules };
}
