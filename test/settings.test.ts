import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROMPT, DEFAULT_SETTINGS, normalizeSettings } from '../src/shared/types.ts';

test('normalizeSettings returns defaults for missing data', () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
});

test('normalizeSettings keeps stored prompts and other fields', () => {
  const stored = {
    provider: 'openai',
    model: 'gpt-5',
    apiKey: 'k',
    baseUrl: '',
    region: 'us-east-1',
    prompts: [
      { id: 'a', title: 'Short', text: 'Summarize briefly.' },
      { id: 'b', title: 'Deep', text: 'Analyze in depth.' },
    ],
  };
  const s = normalizeSettings(stored);
  assert.equal(s.provider, 'openai');
  assert.deepEqual(s.prompts, stored.prompts);
});

test('normalizeSettings migrates a legacy single prompt into the list', () => {
  const s = normalizeSettings({ provider: 'gemini', prompt: 'My custom prompt.' });
  assert.equal(s.provider, 'gemini');
  assert.deepEqual(
    s.prompts.map((p) => p.text),
    ['My custom prompt.'],
  );
  assert.ok(s.prompts[0].id);
  assert.ok(s.prompts[0].title);
});

test('normalizeSettings falls back to the default prompt for an empty list', () => {
  const s = normalizeSettings({ prompts: [] });
  assert.deepEqual(
    s.prompts.map((p) => p.text),
    [DEFAULT_PROMPT],
  );
});
