import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  markdownFilename,
  stripLatexMath,
  withFrontMatter,
  withVideoLink,
} from '../src/shared/markdown.ts';
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

test('withFrontMatter puts title, url and language above the summary', () => {
  assert.equal(
    withFrontMatter('# Summary', transcript()),
    [
      '---',
      'title: "Never Gonna Give You Up"',
      'url: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'language: "en"',
      '---',
      '',
      '# Summary',
    ].join('\n'),
  );
});

test('withFrontMatter leaves out an unknown language', () => {
  const out = withFrontMatter('x', transcript({ language: '' }));
  assert.equal(out.includes('language:'), false);
});

test('withFrontMatter escapes quotes and flattens the title', () => {
  const out = withFrontMatter('x', transcript({ title: 'He said: "hi"\nagain \\ here' }));
  assert.match(out, /^title: "He said: \\"hi\\" again \\\\ here"$/m);
});

test('withFrontMatter falls back to a generic title and passes text through untouched', () => {
  assert.match(withFrontMatter('x', transcript({ title: '' })), /^title: "Video"$/m);
  assert.equal(withFrontMatter('# Summary'), '# Summary');
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

test('stripLatexMath replaces arrow commands with Unicode arrows', () => {
  assert.equal(
    stripLatexMath('Daten rein $\\rightarrow$ Entscheidung'),
    'Daten rein → Entscheidung',
  );
  assert.equal(stripLatexMath('A $\\to$ B $\\longrightarrow$ C'), 'A → B → C');
  assert.equal(stripLatexMath('$\\Rightarrow$'), '⇒');
});

test('stripLatexMath replaces comparison and operator commands', () => {
  assert.equal(stripLatexMath('$\\neq$ und $\\leq$ und $\\times$'), '≠ und ≤ und ×');
  assert.equal(stripLatexMath('Schwellenwert $\\epsilon < 5\\%$'), 'Schwellenwert ε < 5%');
});

test('stripLatexMath unwraps text wrappers inside math spans', () => {
  assert.equal(
    stripLatexMath('$\\text{Aktion} + \\text{Ergebnis} = \\text{Marke}$'),
    'Aktion + Ergebnis = Marke',
  );
  assert.equal(stripLatexMath('$\\textbf{ABER} + \\text{[Vorteil]}$'), 'ABER + [Vorteil]');
  assert.equal(stripLatexMath('$\\mathbf{Live\\text{-}Streamer}$'), 'Live-Streamer');
});

test('stripLatexMath leaves currency and plain dollar text untouched', () => {
  const s = 'von $7k auf $45k–$100k, ein $3M Deal';
  assert.equal(stripLatexMath(s), s);
});

test('stripLatexMath leaves spans with unknown commands untouched', () => {
  const s = 'Formel $\\sum_{i=1}^{n} x_i$ bleibt';
  assert.equal(stripLatexMath(s), s);
});

test('stripLatexMath leaves non-math markdown untouched', () => {
  const s = '# Titel\n\n- Punkt eins\n- `code $x` block';
  assert.equal(stripLatexMath(s), s);
});
