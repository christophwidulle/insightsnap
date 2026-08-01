export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'bedrock' | 'openai-compatible';

export interface Settings {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  /** Only for 'openai-compatible'; the other providers derive their URL themselves. */
  baseUrl: string;
  /** Only for 'bedrock'. */
  region: string;
  prompt: string;
}

// Regions with a Bedrock endpoint (docs.aws.amazon.com/general/latest/gr/bedrock.html),
// GovCloud left out. Whether a region serves bedrock-mantle only shows up on the first
// model request.
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
  'Write a structured summary of this video with the key learnings and takeaways. ' +
  'I want to get the maximum insight out of it. Reply in the language of the transcript.';

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5',
  gemini: 'gemini-2.5-pro',
  // Bedrock model IDs carry a provider and cross-region prefix.
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
  { type: 'LLM_REQUEST'; transcript: string; videoTitle: string } | { type: 'OPEN_OPTIONS' };

export interface LLMResponse {
  ok: boolean;
  content?: string;
  error?: string;
}
