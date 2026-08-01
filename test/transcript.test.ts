import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, parseJson3, parseTimestamp } from '../src/shared/transcript.ts';

test('parseJson3 joins segments, collapses whitespace and converts ms to seconds', () => {
  const body = JSON.stringify({
    events: [
      { tStartMs: 1500, segs: [{ utf8: 'hello  ' }, { utf8: 'world\n' }] },
      { segs: [{ utf8: 'no timestamp' }] },
    ],
  });

  assert.deepEqual(parseJson3(body), [
    { start: 1.5, text: 'hello world' },
    { start: 0, text: 'no timestamp' },
  ]);
});

test('parseJson3 drops whitespace-only events', () => {
  const body = JSON.stringify({ events: [{ tStartMs: 0, segs: [{ utf8: '\n' }] }] });
  assert.deepEqual(parseJson3(body), []);
});

test('parseJson3 returns empty on non-json and on missing events', () => {
  assert.deepEqual(parseJson3('<?xml version="1.0"?><transcript/>'), []);
  assert.deepEqual(parseJson3('{}'), []);
  assert.deepEqual(parseJson3(''), []);
});

test('parseTimestamp handles mm:ss and hh:mm:ss', () => {
  assert.equal(parseTimestamp('0:07'), 7);
  assert.equal(parseTimestamp('12:34'), 754);
  assert.equal(parseTimestamp('1:02:03'), 3723);
});

test('parseTimestamp falls back to 0 on garbage', () => {
  assert.equal(parseTimestamp('later'), 0);
  assert.equal(parseTimestamp(''), 0);
});

test('decodeEntities resolves named, decimal and hex references', () => {
  assert.equal(decodeEntities('a &lt;b&gt; &quot;c&quot; &#39;d&apos;'), `a <b> "c" 'd'`);
  assert.equal(decodeEntities('&#8212; &#x1F600;'), '— 😀');
});

// YouTube double-encodes: &amp;lt; must decode to &lt;, not to <. This only holds while
// the &amp; replacement stays last in decodeEntities.
test('decodeEntities expands ampersands last so double encoding survives one pass', () => {
  assert.equal(decodeEntities('&amp;lt;b&amp;gt;'), '&lt;b&gt;');
  assert.equal(decodeEntities('Tom &amp; Jerry'), 'Tom & Jerry');
});
