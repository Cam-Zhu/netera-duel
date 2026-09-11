// Wraps the app shell and applies the selected era's accent skin via a
// data-era attribute, per claude.md "Visual direction" — the neutral
// paper/ink base never changes, only --accent swaps (see era-themes.css).
export default function EraSkinProvider({ eraId, children }) {
  return (
    <div className="app-shell" data-era={eraId ?? undefined}>
      {children}
    </div>
  )
}
