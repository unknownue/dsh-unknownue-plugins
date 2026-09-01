/**
 * Ported from vendor/paperspace apps/web/app/papers/[arxivId]/model-selection.tsx.
 * Single source of truth for the provider/model/key the reader uses; chat and
 * translation share this context so a translation always runs with the same
 * model as the chat panel.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { providerCatalog } from './provider-catalog';
import { loadCredentials, loadSettings, type ProviderProfile } from './provider-settings';

export interface ModelOption {
  id: string;
  name?: string;
}

export interface ModelSelection {
  profiles: ProviderProfile[];
  credentials: Record<string, string>;
  active: string;
  selectedModel: string;
  current: ProviderProfile | undefined;
  baseUrl: string | undefined;
  model: string | undefined;
  modelOptions: ModelOption[];
  apiKey: string;
  configured: boolean;
  selectModel(providerId: string, modelId: string): void;
  refresh(): void;
}

const ModelSelectionContext = createContext<ModelSelection | null>(null);

export function ModelSelectionProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [active, setActive] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const activeRef = useRef('');

  const refresh = useCallback(() => {
    const settings = loadSettings();
    const next = settings.providers;
    setProfiles(next);
    setCredentials(loadCredentials());
    const provider = next.find(item => item.id === activeRef.current) ?? next[0];
    const nextActive = provider?.id ?? '';
    activeRef.current = nextActive;
    setActive(nextActive);
    setSelectedModel(provider?.models?.[0]?.id ?? '');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectModel = useCallback((providerId: string, modelId: string) => {
    activeRef.current = providerId;
    setActive(providerId);
    setSelectedModel(modelId);
  }, []);

  const current = profiles.find(profile => profile.id === active);
  const catalog = current ? providerCatalog.find(provider => provider.id === current.id) : undefined;
  const baseUrl = current?.baseUrl ?? catalog?.baseUrl;
  const modelOptions: ModelOption[] = current?.models?.length ? current.models : catalog?.models ?? [];
  const model = modelOptions.some(item => item.id === selectedModel) ? selectedModel : modelOptions[0]?.id;
  const apiKey = current?.apiKeyRef ? credentials[current.apiKeyRef] : '';
  const configured = Boolean(current && baseUrl && model && (!current.apiKeyRef || apiKey));

  const value = useMemo<ModelSelection>(
    () => ({ profiles, credentials, active, selectedModel, current, baseUrl, model, modelOptions, apiKey, configured, selectModel, refresh }),
    [profiles, credentials, active, selectedModel, current, baseUrl, model, modelOptions, apiKey, configured, selectModel, refresh],
  );

  return <ModelSelectionContext.Provider value={value}>{children}</ModelSelectionContext.Provider>;
}

export function useModelSelection(): ModelSelection {
  const value = useContext(ModelSelectionContext);
  if (!value) throw new Error('useModelSelection must be used inside ModelSelectionProvider');
  return value;
}
