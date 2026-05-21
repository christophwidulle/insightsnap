import { useEffect, useState } from 'react';
import { loadSettings, saveSettings } from '../shared/storage';
import {
  DEFAULT_MODELS,
  DEFAULT_PROMPT,
  DEFAULT_SETTINGS,
  type LLMProvider,
  type Settings,
} from '../shared/types';

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai-compatible', label: 'OpenAI-kompatibel (Custom URL)' },
];

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function changeProvider(provider: LLMProvider) {
    setSettings((s) => ({
      ...s,
      provider,
      model: s.model || DEFAULT_MODELS[provider],
    }));
  }

  async function onSave() {
    await saveSettings(settings);
    setStatus('Gespeichert.');
    setTimeout(() => setStatus(null), 1500);
  }

  function resetPrompt() {
    update('prompt', DEFAULT_PROMPT);
  }

  const isCustom = settings.provider === 'openai-compatible';

  return (
    <main className="options">
      <header>
        <h1>InsightSnap</h1>
        <p>Konfiguriere LLM-Provider und Prompt für die YouTube-Analyse.</p>
      </header>

      <section>
        <label>
          <span>Provider</span>
          <select
            value={settings.provider}
            onChange={(e) => changeProvider(e.target.value as LLMProvider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Model</span>
          <input
            type="text"
            value={settings.model}
            placeholder={DEFAULT_MODELS[settings.provider] || 'z.B. gpt-5'}
            onChange={(e) => update('model', e.target.value)}
          />
        </label>

        <label>
          <span>API-Key</span>
          <input
            type="password"
            value={settings.apiKey}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => update('apiKey', e.target.value)}
          />
        </label>

        {isCustom && (
          <label>
            <span>Base-URL</span>
            <input
              type="url"
              value={settings.baseUrl}
              placeholder="https://api.example.com/v1"
              onChange={(e) => update('baseUrl', e.target.value)}
            />
          </label>
        )}

        <label>
          <span>Prompt</span>
          <textarea
            rows={6}
            value={settings.prompt}
            onChange={(e) => update('prompt', e.target.value)}
          />
          <button type="button" className="link" onClick={resetPrompt}>
            Auf Default zurücksetzen
          </button>
        </label>
      </section>

      <footer>
        <button type="button" onClick={onSave}>
          Speichern
        </button>
        {status && <span className="status">{status}</span>}
      </footer>
    </main>
  );
}
