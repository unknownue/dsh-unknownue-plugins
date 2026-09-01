/**
 * Paperspace API base for the browser half (same origin as the DSH web app).
 */
export const PAPERS_API = '/dsh-unknownue-plugins/paperspace/api';
export const paperUrl = (ref: string) => `${PAPERS_API}/papers/${encodeURIComponent(ref)}`;
export const settingsUrl = () => `${PAPERS_API}/settings`;
export const sessionsUrl = () => `${PAPERS_API}/sessions`;
export const sessionLinkUrl = (sessionId: string) => `${PAPERS_API}/sessions/${encodeURIComponent(sessionId)}`;
