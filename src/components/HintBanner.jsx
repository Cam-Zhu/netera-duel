export default function HintBanner({ eraName, eraRange, hint }) {
  if (!eraName && !hint) return null

  return (
    <div className="hint-banner">
      {eraName && (
        <div className="hint-banner__era">
          {eraName}
          {eraRange && <span className="hint-banner__era-range"> ({eraRange})</span>}
        </div>
      )}
      {hint && <div className="hint-banner__hint">"{hint}"</div>}
    </div>
  )
}
