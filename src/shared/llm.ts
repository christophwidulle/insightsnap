import type { Settings } from './types';

interface CallArgs {
  settings: Settings;
  systemPrompt: string;
  userContent: string;
}

export async function callLLM({ settings, systemPrompt, userContent }: CallArgs): Promise<string> {
  if (!settings.apiKey && settings.provider !== 'openai-compatible') {
    throw new Error('API-Key fehlt. Bitte in den Einstellungen eintragen.');
  }

  switch (settings.provider) {
    case 'anthropic':
      return callAnthropic(settings, systemPrompt, userContent);
    case 'openai':
      return callOpenAICompatible(
        settings,
        systemPrompt,
        userContent,
        'https://api.openai.com/v1',
      );
    case 'openai-compatible': {
      const base = settings.baseUrl.replace(/\/+$/, '');
      if (!base) throw new Error('Base-URL fehlt für OpenAI-kompatiblen Endpoint.');
      return callOpenAICompatible(settings, systemPrompt, userContent, base);
    }
    case 'gemini':
      return callGemini(settings, systemPrompt, userContent);
  }
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
      return listOpenAICompatible(s, 'https://api.openai.com/v1');
    case 'openai-compatible': {
      const base = s.baseUrl.replace(/\/+$/, '');
      if (!base) throw new Error('Base-URL fehlt für OpenAI-kompatiblen Endpoint.');
      return listOpenAICompatible(s, base);
    }
    case 'gemini': {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(s.apiKey)}`,
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
      max_tokens: 4096,
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
  )}:generateContent?key=${encodeURIComponent(s.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
