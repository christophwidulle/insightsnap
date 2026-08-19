import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownFilename, withVideoLink } from '../src/shared/markdown.ts';
import type { TranscriptResult } from '../src/shared/types.ts';

function transcript(overrides: Partial<TranscriptResult> = {}): TranscriptResult {
  return {
    videoId: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    language: 'en',
    segments: [],
    fullText: '',
    source: 'caption-track',
    ...overrides,
  };
}

test('withVideoLink prepends a markdown link to the video', () => {
  assert.equal(
    withVideoLink('# Summary', transcript()),
    '[Never Gonna Give You Up](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n\n# Summary',
  );
});

test('withVideoLink falls back to a generic title and passes text through untouched', () => {
  assert.match(withVideoLink('x', transcript({ title: '' })), /^\[Video\]\(/);
  assert.equal(withVideoLink('# Summary'), '# Summary');
});

test('markdownFilename keeps the title readable', () => {
  assert.equal(markdownFilename(transcript()), 'Never Gonna Give You Up.md');
});

test('markdownFilename strips characters a file system rejects', () => {
  assert.equal(
    markdownFilename(transcript({ title: 'A/B: "test" <1> | 2*3? \\ done' })),
    'AB test 1 23 done.md',
  );
});

test('markdownFilename drops control characters and collapses whitespace', () => {
  assert.equal(markdownFilename(transcript({ title: 'a b\tc   d' })), 'a bc d.md');
});

test('markdownFilename drops a trailing dot or space', () => {
  assert.equal(markdownFilename(transcript({ title: 'Episode 1. ' })), 'Episode 1.md');
});

test('markdownFilename caps the length', () => {
  const name = markdownFilename(transcript({ title: 'x'.repeat(300) }));
  assert.equal(name, `${'x'.repeat(120)}.md`);
});

test('markdownFilename falls back to the video id, then to a constant', () => {
  assert.equal(markdownFilename(transcript({ title: '  ' })), 'insightsnap-dQw4w9WgXcQ.md');
  assert.equal(markdownFilename(), 'insightsnap.md');
});
