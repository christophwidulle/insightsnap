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
  { value: 'openai-compatible', label: 'OpenAI-compatible (custom URL)' },
];

// Providers without a fixed host in the manifest: access has to be granted first.
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

  // Debounced so typing in the API key field does not fire a request per keystroke.
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
          ? 'Enter a base URL to load the model list.'
          : 'Enter an API key to load the model list.',
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
      setModelNote(`Access to ${target.host} has not been granted yet.`);
      return;
    }
    setGrant(null);

    setModelNote('Loading models…');
    try {
      const list = await listModels(query);
      if (!alive()) return;
      setModels(list);
      setModelNote(list.length > 0 ? null : 'Provider reports no models.');
    } catch (err) {
      if (!alive()) return;
      setModels([]);
      setModelNote(
        `Could not load models: ${err instanceof Error ? err.message : String(err)} – enter the model name manually.`,
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
    setStatus('Saved.');
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
        setModelNote(`Access to ${grant.host} was denied.`);
      }
    });
  }

  const isCustom = settings.provider === 'openai-compatible';

  return (
    <main className="options">
      <header>
        <h1>InsightSnap</h1>
        <p>Configure the LLM provider and prompt used for YouTube analysis.</p>
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
                <option value={settings.model}>{settings.model || '– select a model –'}</option>
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
              placeholder={DEFAULT_MODELS[settings.provider] || 'e.g. gpt-5'}
              onChange={(e) => update('model', e.target.value)}
            />
          )}
          {modelNote && <span className="hint">{modelNote}</span>}
          <button type="button" className="link" onClick={() => void fetchModels()}>
            Reload models
          </button>
        </label>

        <label>
          <span>API key</span>
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
              Endpoint: {resolveBaseUrl(settings)} – authenticates with an Amazon Bedrock API key.
            </span>
          </label>
        )}

        {isCustom && (
          <label>
            <span>Base URL</span>
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
            <span>Access</span>
            <span className="hint">
              InsightSnap may only reach the built-in providers. {grant.host} needs a one-time
              access grant.
            </span>
            <button type="button" className="grant" onClick={requestGrant}>
              Grant access to {grant.host}
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
            Reset to default
          </button>
        </label>
      </section>

      <footer>
        <button type="button" onClick={onSave}>
          Save
        </button>
        {status && <span className="status">{status}</span>}
      </footer>
    </main>
  );
}
