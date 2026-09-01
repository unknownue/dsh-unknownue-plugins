/**
 * Static OpenAI-compatible provider catalog (replaces paperspace's generated
 * pi-ai catalog; custom providers cover everything else).
 */
export interface CatalogModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
}
export interface CatalogProvider {
  id: string;
  displayName: string;
  baseUrl?: string;
  protocol: 'openai-chat' | 'anthropic-messages';
  models: CatalogModel[];
  authLabel?: string;
  credentialRequired: boolean;
}

export const providerCatalog: readonly CatalogProvider[] = [
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    protocol: 'openai-chat',
    credentialRequired: true,
    authLabel: 'API Key',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 65536, maxTokens: 8192 },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', contextWindow: 65536, maxTokens: 8192, reasoning: true },
    ],
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    protocol: 'openai-chat',
    credentialRequired: true,
    authLabel: 'API Key',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', contextWindow: 128000 },
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
    ],
  },
];

export const providerCatalogIds = providerCatalog.map(provider => provider.id);
export function catalogProvider(id: string): CatalogProvider | undefined {
  return providerCatalog.find(provider => provider.id === id);
}
