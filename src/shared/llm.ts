import type { Settings } from './types';

interface CallArgs {
  settings: Settings;
  systemPrompt: string;
  userContent: string;
}

// Basis-URL aller Provider, die OpenAIs Chat-Completions-Format sprechen. Bedrock gehört
// dazu: der bedrock-mantle-Endpoint akzeptiert den Amazon-Bedrock-API-Key als Bearer-Token,
// also braucht er keinen eigenen Request-Pfad, nur eine aus der Region gebaute URL.
// Leerer String heißt "kein solcher Endpoint" (Anthropic/Gemini) bzw. "noch nicht gesetzt".
export function resolveBaseUrl(s: Settings): string {
  switch (s.provider) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'bedrock':
      return s.region ? `https://bedrock-mantle.${s.region}.api.aws/v1` : '';
    case 'openai-compatible':
      return s.baseUrl.replace(/\/+$/, '');
    case 'anthropic':
    case 'gemini':
      return '';
  }
}

export async function callLLM({ settings, systemPrompt, userContent }: CallArgs): Promise<string> {
  if (!settings.apiKey && settings.provider !== 'openai-compatible') {
    throw new Error('API-Key fehlt. Bitte in den Einstellungen eintragen.');
  }

  switch (settings.provider) {
    case 'anthropic':
      return callAnthropic(settings, systemPrompt, userContent);
    case 'openai':
    case 'bedrock':
    case 'openai-compatible':
      return callOpenAICompatible(settings, systemPrompt, userContent, requireBaseUrl(settings));
    case 'gemini':
      return callGemini(settings, systemPrompt, userContent);
  }
}

function requireBaseUrl(s: Settings): string {
  const base = resolveBaseUrl(s);
  if (!base) {
    throw new Error(
      s.provider === 'bedrock'
        ? 'Region fehlt für Bedrock.'
        : 'Base-URL fehlt für OpenAI-kompatiblen Endpoint.',
    );
  }
  return base;
}

// Modell-Listen der Provider. Läuft aus der Options-Seite (Extension-Kontext mit
// host_permissions), daher kein CORS-Problem — sofern der Websitezugriff nicht
// eingeschränkt ist. Fehler werden durchgereicht und in der UI angezeigt.
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
    case 'bedrock':
    case 'openai-compatible':
      return listOpenAICompatible(s, requireBaseUrl(s));
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
  if (!text) throw new Error('Leere Antwort von Anthropic.');
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
  if (!text) throw new Error('Leere Antwort vom Provider.');
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
  if (!text) throw new Error('Leere Antwort von Gemini.');
  return text;
}
