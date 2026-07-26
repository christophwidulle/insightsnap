export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'openai-compatible';

export interface Settings {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  prompt: string;
}

export const DEFAULT_PROMPT =
  'Erstelle mir eine strukturierte Zusammenfassung mit den Key Learnings und Takeaways. ' +
  'Ich möchte das Maximale aus dem Video mitnehmen an Erkenntnissen.';

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5',
  gemini: 'gemini-2.5-pro',
  'openai-compatible': '',
};

export const DEFAULT_SETTINGS: Settings = {
  provider: 'anthropic',
  model: DEFAULT_MODELS.anthropic,
  apiKey: '',
  baseUrl: '',
  prompt: DEFAULT_PROMPT,
};

export interface TranscriptSegment {
  start: number;
  text: string;
}

export interface TranscriptResult {
  videoId: string;
  title: string;
  language: string;
  segments: TranscriptSegment[];
  fullText: string;
  source: 'caption-track' | 'panel';
}

export type RuntimeMessage =
  | { type: 'LLM_REQUEST'; transcript: string; videoTitle: string }
  | { type: 'OPEN_OPTIONS' };

export interface LLMResponse {
  ok: boolean;
  content?: string;
  error?: string;
}
