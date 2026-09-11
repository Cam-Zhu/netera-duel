export default function HintBanner({ eraName, hint }) {
  if (!eraName && !hint) return null

  return (
    <div className="hint-banner">
      {eraName && <div className="hint-banner__era">{eraName}</div>}
      {hint && <div className="hint-banner__hint">"{hint}"</div>}
    </div>
  )
}
