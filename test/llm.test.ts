import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBaseUrl } from '../src/shared/llm.ts';
import { DEFAULT_SETTINGS } from '../src/shared/types.ts';

test('resolveBaseUrl builds the Bedrock endpoint from the region', () => {
  const url = resolveBaseUrl({ ...DEFAULT_SETTINGS, provider: 'bedrock', region: 'eu-central-1' });
  assert.equal(url, 'https://bedrock-mantle.eu-central-1.api.aws/v1');
});

test('resolveBaseUrl trims trailing slashes off a custom base URL', () => {
  const url = resolveBaseUrl({
    ...DEFAULT_SETTINGS,
    provider: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1//',
  });
  assert.equal(url, 'https://api.example.com/v1');
});

test('resolveBaseUrl reports providers without a usable endpoint as empty', () => {
  assert.equal(resolveBaseUrl({ ...DEFAULT_SETTINGS, provider: 'anthropic' }), '');
  assert.equal(resolveBaseUrl({ ...DEFAULT_SETTINGS, provider: 'bedrock', region: '' }), '');
  assert.equal(
    resolveBaseUrl({ ...DEFAULT_SETTINGS, provider: 'openai-compatible', baseUrl: '' }),
    '',
  );
});
