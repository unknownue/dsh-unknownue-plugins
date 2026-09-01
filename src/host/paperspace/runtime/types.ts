/**
 * Ported verbatim from vendor/paperspace packages/agent-runtime/src/types.ts
 * (import specifiers adjusted to bundle-local resolution).
 */
export type AgentEvent =
  | { type: 'meta.chat_id'; chat_id: string }
  | { type: 'iteration.start'; index: number }
  | { type: 'tool.call'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'tool.result'; id: string; name: string; result: unknown }
  | { type: 'delta.text'; text: string }
  | { type: 'delta.thinking'; text: string }
  | { type: 'usage'; tokens_in: number; tokens_out: number }
  | { type: 'done'; status: 'completed' | 'aborted' | 'timeout' | 'error' }
  | { type: 'error'; code: string; message: string };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}
export interface ProviderRequest { messages: ChatMessage[]; tools?: ToolDefinition[]; signal?: AbortSignal }
export interface ProviderChunk {
  text?: string; thinking?: string;
  tool_call?: { id: string; name: string; arguments: string };
  usage?: { tokens_in: number; tokens_out: number };
}
export interface Provider { stream(request: ProviderRequest): AsyncIterable<ProviderChunk> }
export interface ToolDefinition { name: string; description: string; parameters: Record<string, unknown> }
export interface PaperContext { paperId: string; markdown: string }
export interface PaperTool { definition: ToolDefinition; execute(args: unknown): Promise<unknown> }
export interface AgentOptions {
  provider: Provider; paper: PaperContext; messages: ChatMessage[];
  chatId?: string; signal?: AbortSignal; timeoutMs?: number;
  tools?: PaperTool[];
}
export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';
