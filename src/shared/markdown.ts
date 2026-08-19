import type { TranscriptResult } from './types';

function videoUrl({ videoId }: TranscriptResult): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Copying lands in a chat or a note, where a link reads better than metadata.
export function withVideoLink(text: string, transcript?: TranscriptResult): string {
  if (!transcript) return text;
  return `[${transcript.title || 'Video'}](${videoUrl(transcript)})\n\n${text}`;
}

// A double-quoted scalar is the only YAML style that survives colons, quotes and #
// in a video title. Backslash and quote are the sole escapes it needs.
function yamlString(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return `"${flat.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// The downloaded file goes into a note vault, so the video metadata belongs in front
// matter where Obsidian & friends can index it.
export function withFrontMatter(text: string, transcript?: TranscriptResult): string {
  if (!transcript) return text;
  const lines = [
    '---',
    `title: ${yamlString(transcript.title || 'Video')}`,
    `url: ${videoUrl(transcript)}`,
  ];
  if (transcript.language) lines.push(`language: ${yamlString(transcript.language)}`);
  lines.push('---', '');
  return `${lines.join('\n')}\n${text}`;
}

// Windows rejects <>:"/\|?* and control characters in file names, macOS chokes on ':'.
// Keep the title readable, strip everything a file system could argue about.
const ILLEGAL = /[\p{Cc}"*/:<>?\\|]/gu;

export function markdownFilename(transcript?: TranscriptResult): string {
  const safe = (transcript?.title ?? '')
    .replace(ILLEGAL, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    // A trailing dot or space is dropped silently by Windows, so drop it deliberately.
    .replace(/[.\s]+$/, '');
  if (safe) return `${safe}.md`;
  return transcript?.videoId ? `insightsnap-${transcript.videoId}.md` : 'insightsnap.md';
}
