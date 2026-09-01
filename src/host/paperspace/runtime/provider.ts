/**
 * Ported verbatim from vendor/paperspace packages/agent-runtime/src/provider.ts.
 */
import { parseSse } from './sse';
import type { ChatMessage, Provider, ProviderChunk, ProviderRequest, ToolDefinition } from './types';
export interface OpenAIProviderOptions { baseUrl: string; apiKey?: string; model: string; fetch?: typeof globalThis.fetch; timeoutMs?: number }
export class OpenAICompatibleProvider implements Provider {
  constructor(private readonly options: OpenAIProviderOptions) {}
  async *stream(request: ProviderRequest): AsyncGenerator<ProviderChunk> {
    const controller = new AbortController(); const signal = mergeSignals(request.signal, controller.signal);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (this.options.timeoutMs) timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await (this.options.fetch ?? fetch)(this.options.baseUrl.replace(/\/$/, '') + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', ...(this.options.apiKey ? {authorization: 'Bearer ' + this.options.apiKey} : {}) }, body: JSON.stringify({model: this.options.model, messages: request.messages, tools: request.tools?.map(tool => ({type: 'function', function: {name: tool.name, description: tool.description, parameters: tool.parameters}})), stream: true}), signal });
      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '');
        let message = detail.trim();
        try { const parsed = JSON.parse(message); message = parsed.error?.message ?? parsed.message ?? message; } catch { /* Keep non-JSON provider text. */ }
        throw new Error(`LLM request failed (${response.status})${message ? `: ${message}` : ''}`);
      }
      const calls = new Map<string, {name: string; args: string}>();
      for await (const item of parseSse(response.body)) {
        if (item.data === '[DONE]') continue;
        let json: any; try { json = JSON.parse(item.data); } catch { continue; }
        const choice = json.choices?.[0]; const delta = choice?.delta;
        if (delta?.content) yield {text: delta.content};
        if (delta?.reasoning_content || delta?.thinking) yield {thinking: delta.reasoning_content ?? delta.thinking};
        for (const call of delta?.tool_calls ?? []) { const id = call.id ?? [...calls.keys()][call.index ?? 0] ?? crypto.randomUUID(); const old = calls.get(id) ?? {name:'',args:''}; old.name += call.function?.name ?? ''; old.args += call.function?.arguments ?? ''; calls.set(id, old); }
        if (json.usage) yield {usage: {tokens_in: json.usage.prompt_tokens ?? 0, tokens_out: json.usage.completion_tokens ?? 0}};
      }
      for (const [id, call] of calls) yield {tool_call: {id, name: call.name, arguments: call.args}};
    } finally { if (timer) clearTimeout(timer); }
  }
}
function mergeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal { if (!a) return b!; const c = new AbortController(); const abort = () => c.abort(); if (a.aborted || b?.aborted) c.abort(); else { a.addEventListener('abort', abort, {once:true}); b?.addEventListener('abort', abort, {once:true}); } return c.signal; }
