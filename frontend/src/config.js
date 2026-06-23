// In dev the page is served by Vite (:5173) while the backend/socket is on :3001.
// In production one server serves both, so use same-origin ('' => current origin).
export const BACKEND_ORIGIN = import.meta.env.DEV ? `http://${window.location.hostname}:3001` : '';

// Ask the backend for the LAN IP at runtime (auto-detected server-side).
// No env baking, no manual entry — same build works on any network.
export async function fetchLanHost() {
  try {
    const res = await fetch(`${BACKEND_ORIGIN}/api/config`);
    const data = await res.json();
    return data.lanIp || window.location.hostname;
  } catch {
    return window.location.hostname;
  }
}
