import type { Settings } from './types';

interface CallArgs {
  settings: Settings;
  systemPrompt: string;
  userContent: string;
}

export async function callLLM({ settings, systemPrompt, userContent }: CallArgs): Promise<string> {
  if (!settings.apiKey && settings.provider !== 'openai-compatible') {
    throw new Error('No API key set. Add one in the extension options.');
  }

  switch (settings.provider) {
    case 'anthropic':
      return callAnthropic(settings, systemPrompt, userContent);
    case 'openai':
      return callOpenAICompatible(settings, systemPrompt, userContent, 'https://api.openai.com/v1');
    case 'openai-compatible': {
      const base = settings.baseUrl.replace(/\/+$/, '');
      if (!base) throw new Error('No base URL set for the OpenAI-compatible endpoint.');
      return callOpenAICompatible(settings, systemPrompt, userContent, base);
    }
    case 'gemini':
      return callGemini(settings, systemPrompt, userContent);
  }
}

// Model lists per provider. Runs from the options page (extension context with
// host_permissions), so no CORS issue. Errors bubble up and are shown in the UI.
export async function listModels(s: Settings): Promise<string[]> {
  switch (s.provider) {
    case 'anthropic': {
      const res = await fetch('https://api.anthropic.com/v1/models?limit=1000', {
        headers: {
          'x-api-key': s.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });
      const data = await okJson(res, 'Anthropic');
      return sorted((data?.data ?? []).map((m: { id: string }) => m.id));
    }
    case 'openai':
      return listOpenAICompatible(s, 'https://api.openai.com/v1');
    case 'openai-compatible': {
      const base = s.baseUrl.replace(/\/+$/, '');
      if (!base) throw new Error('No base URL set for the OpenAI-compatible endpoint.');
      return listOpenAICompatible(s, base);
    }
    case 'gemini': {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
        { headers: { 'x-goog-api-key': s.apiKey } },
      );
      const data = await okJson(res, 'Gemini');
      const models: { name: string; supportedGenerationMethods?: string[] }[] = data?.models ?? [];
      return sorted(
        models
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? true)
          .map((m) => m.name.replace(/^models\//, '')),
      );
    }
  }
}

async function listOpenAICompatible(s: Settings, baseUrl: string): Promise<string[]> {
  const headers: Record<string, string> = {};
  if (s.apiKey) headers.authorization = `Bearer ${s.apiKey}`;
  const res = await fetch(`${baseUrl}/models`, { headers });
  const data = await okJson(res, 'Provider');
  return sorted((data?.data ?? []).map((m: { id: string }) => m.id));
}

async function okJson(res: Response, label: string) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `${label} ${res.status}`);
  return data;
}

function sorted(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

async function callAnthropic(s: Settings, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': s.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: s.model,
      // Anthropic requires this field. 8192 covers any realistic summary; legacy
      // models capped at 4096 (claude-3-haiku) will surface a 400 from the API.
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Anthropic ${res.status}`);
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n');
  if (!text) throw new Error('Empty response from Anthropic.');
  return text;
}

async function callOpenAICompatible(
  s: Settings,
  system: string,
  user: string,
  baseUrl: string,
): Promise<string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (s.apiKey) headers.authorization = `Bearer ${s.apiKey}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: s.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Provider ${res.status}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from provider.');
  return text;
}

async function callGemini(s: Settings, system: string, user: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    s.model,
  )}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': s.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Gemini ${res.status}`);
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('');
  if (!text) throw new Error('Empty response from Gemini.');
  return text;
}
