/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
// Only hashes and random command IDs are retained; no operational payloads.
export async function commandIdentity(method: string, path: string, body: unknown) {
  const canonical = JSON.stringify({ method, path, body }, (_key, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  );
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const storageKey = `ansei-command:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
  const id = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
  sessionStorage.setItem(storageKey, id);
  return { id, complete: () => { if (sessionStorage.getItem(storageKey) === id) sessionStorage.removeItem(storageKey); } };
}
