import { useEffect, useState } from 'react';
import { listModels, resolveBaseUrl } from '../shared/llm';
import { loadSettings, saveSettings } from '../shared/storage';
import {
  BEDROCK_REGIONS,
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
  { value: 'bedrock', label: 'AWS Bedrock' },
  { value: 'openai-compatible', label: 'OpenAI-kompatibel (Custom URL)' },
];

// Provider ohne festen Host im Manifest: der Zugriff wird erst nach Freigabe erteilt.
const NEEDS_GRANT: LLMProvider[] = ['bedrock', 'openai-compatible'];

// Chrome match patterns carry no port, so http://localhost:11434 has to collapse to
// http://localhost/* before it can be requested.
function hostPattern(url: string): { pattern: string; host: string } | null {
  try {
    const u = new URL(url);
    return { pattern: `${u.protocol}//${u.hostname}/*`, host: u.hostname };
  } catch {
    return null;
  }
}

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [grant, setGrant] = useState<{ pattern: string; host: string } | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const { provider, apiKey, baseUrl, region } = settings;

  // Debounced, damit das Tippen im API-Key-Feld nicht pro Zeichen eine Anfrage auslöst.
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => void fetchModels(() => alive), 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [provider, apiKey, baseUrl, region]);

  async function fetchModels(alive: () => boolean = () => true) {
    const query = { ...DEFAULT_SETTINGS, provider, apiKey, baseUrl, region };
    const missing = provider === 'openai-compatible' ? !baseUrl : !apiKey;
    if (missing) {
      setModels([]);
      setGrant(null);
      setModelNote(
        provider === 'openai-compatible'
          ? 'Base-URL eintragen – dann werden die Modelle geladen.'
          : 'API-Key eintragen – dann werden die Modelle geladen.',
      );
      return;
    }

    // Anthropic/OpenAI/Gemini are in the manifest; Bedrock's regional host and a custom
    // endpoint have to be granted by the user before either this fetch or the service
    // worker can reach them.
    const target = NEEDS_GRANT.includes(provider) ? hostPattern(resolveBaseUrl(query)) : null;
    if (target && !(await chrome.permissions.contains({ origins: [target.pattern] }))) {
      if (!alive()) return;
      setModels([]);
      setGrant(target);
      setModelNote(`Zugriff auf ${target.host} noch nicht erteilt.`);
      return;
    }
    setGrant(null);

    setModelNote('Lade Modelle…');
    try {
      const list = await listModels(query);
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

  // chrome.permissions.request needs an unbroken user gesture — no await before the call.
  function requestGrant() {
    if (!grant) return;
    void chrome.permissions.request({ origins: [grant.pattern] }).then((granted) => {
      if (granted) {
        setGrant(null);
        void fetchModels();
      } else {
        setModelNote(`Zugriff auf ${grant.host} abgelehnt.`);
      }
    });
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

        {provider === 'bedrock' && (
          <label>
            <span>Region</span>
            <select value={settings.region} onChange={(e) => update('region', e.target.value)}>
              {BEDROCK_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="hint">
              Endpoint: {resolveBaseUrl(settings)} – Auth über einen Amazon-Bedrock-API-Key.
            </span>
          </label>
        )}

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

        {grant && (
          <label>
            <span>Zugriff</span>
            <span className="hint">
              InsightSnap darf nur die eingebauten Provider erreichen. Für {grant.host} musst du
              den Zugriff einmalig freigeben.
            </span>
            <button type="button" className="grant" onClick={requestGrant}>
              Zugriff auf {grant.host} erlauben
            </button>
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
