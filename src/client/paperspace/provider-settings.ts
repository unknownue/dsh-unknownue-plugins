/**
 * Ported from vendor/paperspace apps/web/app/settings/models/provider-settings.ts.
 * Provider profiles + credentials in browser localStorage (keys separate).
 */
export type ModelProfile = { id: string; name?: string; contextWindow?: number; maxTokens?: number };
export type ProviderProfile = {
  id: string;
  displayName: string;
  baseUrl?: string;
  protocol?: 'openai-chat' | 'anthropic-messages';
  models?: ModelProfile[];
  apiKeyRef?: string;
  custom?: boolean;
  revision: number;
};
export type SettingsDocument = { revision: number; providers: ProviderProfile[] };
export const SETTINGS_KEY = 'paperspace.settings.providers.v1';
export const CREDENTIALS_KEY = 'paperspace.credentials.v1';
export function keyRef(id: string) {
  return id.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_API_KEY';
}
export function validateApiKey(value: string): string | undefined {
  if (value === '') return;
  const trimmed = value.trim();
  if (!trimmed) return 'API key cannot contain only whitespace.';
  if (/^(['"]).*\1$/.test(trimmed)) return 'Paste the API key without quotes.';
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(trimmed)) return 'Paste the key value, not a NAME=value line.';
  if (!/^[\x21-\x7e]+$/.test(trimmed)) return 'API key contains unsupported characters.';
}
export function validateRoute(id: string) {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) ? undefined : 'Use lowercase letters, digits, and hyphens; start with a letter.';
}
export function loadSettings(): SettingsDocument {
  try {
    const value = localStorage.getItem(SETTINGS_KEY);
    return value ? JSON.parse(value) : { revision: 0, providers: [] };
  } catch {
    return { revision: 0, providers: [] };
  }
}
export function loadCredentials(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CREDENTIALS_KEY) ?? '{}');
  } catch {
    return {};
  }
}
export function saveSettings(value: SettingsDocument) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
}
export function saveCredentials(value: Record<string, string>) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(value));
}
