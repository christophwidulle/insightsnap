export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'bedrock' | 'openai-compatible';

export interface Settings {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  /** Nur für 'openai-compatible'; die anderen Provider leiten ihre URL selbst ab. */
  baseUrl: string;
  /** Nur für 'bedrock'. */
  region: string;
  prompt: string;
}

// Regionen mit Bedrock-Endpoint (docs.aws.amazon.com/general/latest/gr/bedrock.html),
// ohne GovCloud. Ob eine Region bedrock-mantle bedient, zeigt erst die Modell-Abfrage.
export const BEDROCK_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-2',
  'ca-central-1',
  'sa-east-1',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'eu-south-1',
  'eu-south-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-south-1',
  'ap-south-2',
  'ap-southeast-1',
  'ap-southeast-2',
];

export const DEFAULT_PROMPT =
  'Erstelle mir eine strukturierte Zusammenfassung mit den Key Learnings und Takeaways. ' +
  'Ich möchte das Maximale aus dem Video mitnehmen an Erkenntnissen.';

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5',
  gemini: 'gemini-2.5-pro',
  // Bedrock-Modell-IDs tragen Provider- und Cross-Region-Präfix.
  bedrock: 'us.anthropic.claude-sonnet-4-6',
  'openai-compatible': '',
};

export const DEFAULT_SETTINGS: Settings = {
  provider: 'anthropic',
  model: DEFAULT_MODELS.anthropic,
  apiKey: '',
  baseUrl: '',
  region: 'us-east-1',
  prompt: DEFAULT_PROMPT,
};

// Runaway guard, not a cost control: a 3h video is ~150k chars, which every current
// model swallows. This only stops a 12h stream with auto-captions from being sent whole.
export const MAX_TRANSCRIPT_CHARS = 400_000;

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
