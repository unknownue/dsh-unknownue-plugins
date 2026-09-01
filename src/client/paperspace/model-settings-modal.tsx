/**
 * Model settings modal — compact rewrite of paperspace's settings/models page
 * (same localStorage persistence, same validation).
 */
import { FormEvent, useEffect, useState } from 'react';
import { providerCatalog, type CatalogProvider } from './provider-catalog';
import {
  keyRef,
  loadCredentials,
  loadSettings,
  saveCredentials,
  saveSettings,
  validateApiKey,
  validateRoute,
  type ModelProfile,
  type ProviderProfile,
} from './provider-settings';

type Target = { catalog?: CatalogProvider; profile?: ProviderProfile };

export default function ModelSettingsModal({ onClose }: { onClose: () => void }) {
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [target, setTarget] = useState<Target>();
  const [custom, setCustom] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setProfiles(loadSettings().providers);
    setCredentials(loadCredentials());
  }, []);

  function commit(next: ProviderProfile[], nextCredentials = credentials) {
    const doc = loadSettings();
    saveSettings({ revision: doc.revision + 1, providers: next });
    saveCredentials(nextCredentials);
    setProfiles(next);
    setCredentials(nextCredentials);
    setNotice('Provider settings saved.');
  }

  function remove(profile: ProviderProfile) {
    if (!confirm('Remove this provider profile? Its browser-stored credential will also be removed.')) return;
    const nextCredentials = { ...credentials };
    if (profile.apiKeyRef) delete nextCredentials[profile.apiKeyRef];
    commit(
      profiles.filter(p => p.id !== profile.id),
      nextCredentials,
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <main className="settings-page" onClick={event => event.stopPropagation()}>
        <header>
          <p className="eyebrow">SETTINGS</p>
          <h1>Models</h1>
          <p>Configure providers and credentials. Keys are stored separately from provider settings in this browser.</p>
        </header>
        {notice && (
          <p className="settings-notice" role="status">
            {notice}
          </p>
        )}
        <section className="settings-section">
          <h2>Configured providers</h2>
          {profiles.length === 0 ? (
            <p className="settings-empty">No provider is configured yet. Choose one from the catalog below.</p>
          ) : (
            profiles.map(profile => {
              const hasKey = profile.apiKeyRef ? Boolean(credentials[profile.apiKeyRef]) : true;
              return (
                <article className="settings-row" key={profile.id}>
                  <div>
                    <strong>{profile.displayName}</strong>
                    <small>
                      {profile.id} · {profile.baseUrl ?? 'catalog base URL'} · {profile.models?.length ?? 0} models
                      {profile.apiKeyRef ? (hasKey ? ' · key ✓' : ' · key missing') : ''}
                    </small>
                  </div>
                  <div className="settings-row-actions">
                    <button
                      type="button"
                      className="button compact"
                      onClick={() => {
                        setTarget({ profile });
                        setCustom(Boolean(profile.custom));
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="button compact ghost" onClick={() => remove(profile)}>
                      Remove
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
        <section className="settings-section">
          <h2>Catalog</h2>
          {providerCatalog.map(catalog => (
            <article className="settings-row" key={catalog.id}>
              <div>
                <strong>{catalog.displayName}</strong>
                <small>
                  {catalog.baseUrl ?? 'custom endpoint'} · {catalog.models.length} models
                </small>
              </div>
              <button
                type="button"
                className="button compact"
                onClick={() => {
                  setTarget({ catalog });
                  setCustom(false);
                }}
              >
                Set up
              </button>
            </article>
          ))}
          <article className="settings-row">
            <div>
              <strong>Custom provider</strong>
              <small>Any OpenAI-compatible endpoint.</small>
            </div>
            <button
              type="button"
              className="button compact"
              onClick={() => {
                setTarget({});
                setCustom(true);
              }}
            >
              Set up
            </button>
          </article>
        </section>
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
        </div>
        {target && (
          <Editor
            target={target}
            custom={custom}
            profiles={profiles}
            credentials={credentials}
            onClose={() => setTarget(undefined)}
            onSave={(next, nextKeys) => {
              commit(next, nextKeys);
              setTarget(undefined);
            }}
          />
        )}
      </main>
    </div>
  );
}

function Editor({
  target,
  custom,
  profiles,
  credentials,
  onClose,
  onSave,
}: {
  target: Target;
  custom: boolean;
  profiles: ProviderProfile[];
  credentials: Record<string, string>;
  onClose: () => void;
  onSave: (p: ProviderProfile[], c: Record<string, string>) => void;
}) {
  const source = target.profile;
  const catalog = target.catalog ?? providerCatalog.find(c => c.id === source?.id);
  const [id, setId] = useState(source?.id ?? catalog?.id ?? '');
  const [name, setName] = useState(source?.displayName ?? catalog?.displayName ?? '');
  const [baseUrl, setBaseUrl] = useState(source?.baseUrl ?? catalog?.baseUrl ?? '');
  const [models, setModels] = useState<ModelProfile[]>(source?.models ?? catalog?.models ?? []);
  const [apiKey, setApiKey] = useState(source?.apiKeyRef ? credentials[source.apiKeyRef] ?? '' : '');
  const keyError = validateApiKey(apiKey);
  const routeError = custom ? validateRoute(id) : undefined;

  function save(e: FormEvent) {
    e.preventDefault();
    if (routeError || keyError || !id || !name || !baseUrl || models.some(m => !m.id) || new Set(models.map(m => m.id)).size !== models.length) return;
    const ref = apiKey ? keyRef(id) : undefined;
    const profile: ProviderProfile = {
      id,
      displayName: name,
      baseUrl,
      protocol: 'openai-chat',
      models,
      ...(ref ? { apiKeyRef: ref } : {}),
      ...(custom ? { custom: true } : {}),
      revision: (source?.revision ?? 0) + 1,
    };
    const next = profiles.some(p => p.id === id) ? profiles.map(p => (p.id === id ? profile : p)) : [...profiles, profile];
    const nextKeys = { ...credentials };
    if (ref && apiKey) nextKeys[ref] = apiKey;
    if (source?.apiKeyRef && source.apiKeyRef !== ref) delete nextKeys[source.apiKeyRef];
    onSave(next, nextKeys);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="dialog settings-editor" onSubmit={save} onClick={event => event.stopPropagation()}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">{custom ? 'CUSTOM PROVIDER' : 'PROVIDER PROFILE'}</p>
            <h2>{source ? 'Edit' : 'Set up'} {name || 'provider'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>
        <label htmlFor="provider-id">Provider ID</label>
        <input id="provider-id" value={id} onChange={event => setId(event.target.value)} disabled={!custom} placeholder="my-provider" />
        {routeError && <p className="form-error">{routeError}</p>}
        <label htmlFor="provider-name">Display name</label>
        <input id="provider-name" value={name} onChange={event => setName(event.target.value)} />
        <label htmlFor="provider-base-url">Base URL</label>
        <input id="provider-base-url" value={baseUrl} onChange={event => setBaseUrl(event.target.value)} placeholder="https://api.deepseek.com" />
        <label htmlFor="provider-models">Models (one per line: id[, name])</label>
        <textarea
          id="provider-models"
          rows={4}
          value={models.map(m => (m.name ? `${m.id}, ${m.name}` : m.id)).join('\n')}
          onChange={event => {
            setModels(
              event.target.value
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => {
                  const [modelId, ...rest] = line.split(',').map(part => part.trim());
                  return rest.length ? { id: modelId, name: rest.join(', ') } : { id: modelId };
                }),
            );
          }}
        />
        <label htmlFor="provider-key">API key</label>
        <input id="provider-key" type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} autoComplete="off" />
        {keyError && <p className="form-error">{keyError}</p>}
        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={Boolean(routeError || keyError)}>
            Save provider
          </button>
        </div>
      </form>
    </div>
  );
}
