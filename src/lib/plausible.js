// Thin wrapper around window.plausible (loaded via the script tag in
// index.html). Safe to call even if the script is blocked or hasn't loaded
// yet — the queue shim in index.html absorbs calls until it does.
export function track(eventName, props) {
  if (typeof window === 'undefined' || typeof window.plausible !== 'function') return
  window.plausible(eventName, props ? { props } : undefined)
}
