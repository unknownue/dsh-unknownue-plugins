/**
 * Ported verbatim from vendor/paperspace packages/agent-runtime/src/runtime.ts.
 */
import type { AgentEvent, AgentOptions, ChatMessage, PaperTool, Provider, ToolDefinition } from './types';

/**
 * Stream one model round: forward text, thinking, and usage chunks and collect
 * the assistant's tool calls, yielding them once the round settles.
 */
async function* streamRound(
  messages: ChatMessage[],
  toolDefs: ToolDefinition[],
  signal: AbortSignal,
  provider: Provider,
): AsyncGenerator<AgentEvent, Array<{ id: string; name: string; arguments: string }>> {
  const calls: Array<{ id: string; name: string; arguments: string }> = [];
  for await (const chunk of provider.stream({ messages, tools: toolDefs, signal })) {
    // A provider that keeps yielding without observing the signal must not
    // hold the round open past a timeout or cancellation: abort on the next chunk.
    if (signal.aborted) throw new DOMException('The request was aborted', 'AbortError');
    if (chunk.text) yield { type: 'delta.text', text: chunk.text };
    if (chunk.thinking) yield { type: 'delta.thinking', text: chunk.thinking };
    if (chunk.usage) yield { type: 'usage', tokens_in: chunk.usage.tokens_in, tokens_out: chunk.usage.tokens_out };
    if (chunk.tool_call) calls.push(chunk.tool_call);
  }
  return calls;
}

export async function* runAgent(options: AgentOptions): AsyncGenerator<AgentEvent> {
  const tools = options.tools ?? []; const byName = new Map(tools.map(t=>[t.definition.name,t]));
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>|undefined; let timedOut = false; const signal=combine(options.signal, controller.signal);
  if(options.timeoutMs) timer=setTimeout(()=>{ timedOut = true; controller.abort(); },options.timeoutMs);
  try {
    if(options.chatId) yield {type:'meta.chat_id',chat_id:options.chatId};
    const messages=[...options.messages]; const toolDefs=tools.map(tool=>tool.definition);
    // No iteration cap: the loop keeps going while the model calls tools and
    // ends when the model answers without tool calls, errors, or the timeout
    // or a cancellation aborts the request.
    for(let index=0; ; index++) {
      if(signal.aborted) { yield {type:'done',status:'aborted'}; return; }
      yield {type:'iteration.start',index};
      let calls: Array<{id:string;name:string;arguments:string}>;
      try { calls = yield* streamRound(messages, toolDefs, signal, options.provider); }
      catch(error) { const status=signal.aborted ? (timedOut ? 'timeout':'aborted') : 'error'; yield {type:'error',code:status,message:error instanceof Error?error.message:String(error)}; yield {type:'done',status}; return; }
      if(!calls.length) { yield {type:'done',status:'completed'}; return; }
      const assistantCalls=calls.map(c=>({id:c.id,type:'function' as const,function:{name:c.name,arguments:c.arguments}})); messages.push({role:'assistant',content:'',tool_calls:assistantCalls});
      for(const call of calls) { let args: Record<string, unknown>; try { const parsed=JSON.parse(call.arguments||'{}'); if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) throw new Error('arguments must be an object'); args=parsed; } catch(error) { yield {type:'tool.call',id:call.id,name:call.name,arguments:{}}; const result={error:'invalid arguments'}; yield {type:'tool.result',id:call.id,name:call.name,result}; messages.push({role:'tool',tool_call_id:call.id,name:call.name,content:JSON.stringify(result)}); continue; }
        yield {type:'tool.call',id:call.id,name:call.name,arguments:args}; const tool=byName.get(call.name); let result: unknown; try { result=tool ? await tool.execute(args) : {error:'unknown tool'}; } catch(error) { result={error:error instanceof Error?error.message:String(error)}; } yield {type:'tool.result',id:call.id,name:call.name,result}; messages.push({role:'tool',tool_call_id:call.id,name:call.name,content:JSON.stringify(result)}); }
    }
  } finally { if(timer) clearTimeout(timer); }
}
function combine(a?:AbortSignal,b?:AbortSignal):AbortSignal { if(!a)return b!; const c=new AbortController(); const abort=()=>c.abort(); if(a.aborted||b?.aborted)c.abort(); else {a.addEventListener('abort',abort,{once:true});b?.addEventListener('abort',abort,{once:true});} return c.signal; }
