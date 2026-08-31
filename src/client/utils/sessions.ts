/**
 * Resolve the working directory for a session.
 */

export function resolveCwd(sessions: any, sessionId: string | undefined): string {
  try {
    if (!sessions || !sessionId) return "";
    const binding =
      typeof sessions.binding === "function"
        ? sessions.binding(sessionId)
        : undefined;
    const headerCwd =
      binding && binding.session && binding.session.header
        ? binding.session.header.cwd
        : undefined;
    if (typeof headerCwd === "string" && headerCwd !== "") return headerCwd;
    const snapshot =
      sessions.list && typeof sessions.list.getSnapshot === "function"
        ? sessions.list.getSnapshot()
        : undefined;
    if (snapshot && snapshot.byId) {
      const summary = snapshot.byId[sessionId];
      if (summary && typeof summary.cwd === "string" && summary.cwd !== "")
        return summary.cwd;
    }
    return "";
  } catch {
    return "";
  }
}
