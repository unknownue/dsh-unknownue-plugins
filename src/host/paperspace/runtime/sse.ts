/**
 * Ported verbatim from vendor/paperspace packages/agent-runtime/src/sse.ts.
 */
import type { AgentEvent } from './types';

export function encodeSse(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
export function encodeSseEvents(events: Iterable<AgentEvent>): string { return Array.from(events, encodeSse).join(''); }

export async function* parseSse(input: AsyncIterable<string> | ReadableStream<Uint8Array>): AsyncGenerator<{ event?: string; data: string }> {
  const chunks: AsyncIterable<string> = isReadable(input) ? decode(input) : input;
  let buffer = ''; let event: string | undefined; let data: string[] = [];
  for await (const chunk of chunks) {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line) { if (data.length) yield { event, data: data.join('\n') }; event = undefined; data = []; continue; }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':'); const field = colon < 0 ? line : line.slice(0, colon);
      const value = (colon < 0 ? '' : line.slice(colon + 1)).replace(/^ /, '');
      if (field === 'event') event = value; else if (field === 'data') data.push(value);
    }
  }
  if (buffer) { const line = buffer; if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, '')); }
  if (data.length) yield { event, data: data.join('\n') };
}
function isReadable(value: unknown): value is ReadableStream<Uint8Array> { return typeof value === 'object' && value !== null && 'getReader' in value; }
async function* decode(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> { const reader = stream.getReader(); const decoder = new TextDecoder(); try { while (true) { const part = await reader.read(); if (part.done) { const tail = decoder.decode(); if (tail) yield tail; break; } yield decoder.decode(part.value, {stream: true}); } } finally { reader.releaseLock(); } }
