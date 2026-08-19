import type { TranscriptResult } from './types';

// Copy and download hand out the same document: the video link first, then the text.
export function withVideoLink(text: string, transcript?: TranscriptResult): string {
  if (!transcript) return text;
  const title = transcript.title || 'Video';
  return `[${title}](https://www.youtube.com/watch?v=${transcript.videoId})\n\n${text}`;
}

// Windows rejects <>:"/\|?* and control characters in file names, macOS chokes on ':'.
// Keep the title readable, strip everything a file system could argue about.
const ILLEGAL = /[\u0000-\u001f"*/:<>?\\|]/g;

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
