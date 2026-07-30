import { useEffect, useState } from 'react';
import { listModels } from '../shared/llm';
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
  const [models, setModels] = useState<string[]>([]);
  const [modelNote, setModelNote] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const { provider, apiKey, baseUrl } = settings;

  // Debounced, damit das Tippen im API-Key-Feld nicht pro Zeichen eine Anfrage auslöst.
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => void fetchModels(() => alive), 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [provider, apiKey, baseUrl]);

  async function fetchModels(alive: () => boolean = () => true) {
    const missing = provider === 'openai-compatible' ? !baseUrl : !apiKey;
    if (missing) {
      setModels([]);
      setModelNote(
        provider === 'openai-compatible'
          ? 'Base-URL eintragen – dann werden die Modelle geladen.'
          : 'API-Key eintragen – dann werden die Modelle geladen.',
      );
      return;
    }

    setModelNote('Lade Modelle…');
    try {
      const list = await listModels({ ...DEFAULT_SETTINGS, provider, apiKey, baseUrl });
      if (!alive()) return;
      setModels(list);
      setModelNote(list.length > 0 ? null : 'Provider meldet keine Modelle.');
    } catch (err) {
      if (!alive()) return;
      setModels([]);
      setModelNote(
        `Modelle nicht ladbar: ${err instanceof Error ? err.message : String(err)} – Modell manuell eintragen.`,
      );
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function changeProvider(next: LLMProvider) {
    setSettings((s) => ({ ...s, provider: next, model: DEFAULT_MODELS[next] }));
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
          {models.length > 0 ? (
            <select value={settings.model} onChange={(e) => update('model', e.target.value)}>
              {!models.includes(settings.model) && (
                <option value={settings.model}>{settings.model || '– bitte wählen –'}</option>
              )}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={settings.model}
              placeholder={DEFAULT_MODELS[settings.provider] || 'z.B. gpt-5'}
              onChange={(e) => update('model', e.target.value)}
            />
          )}
          {modelNote && <span className="hint">{modelNote}</span>}
          <button type="button" className="link" onClick={() => void fetchModels()}>
            Modelle neu laden
          </button>
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
