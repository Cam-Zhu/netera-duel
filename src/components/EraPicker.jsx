import { getEras } from '../lib/wordbank'

export default function EraPicker({ selectedEraId, onSelect }) {
  const eras = getEras()

  return (
    <div className="era-picker">
      {eras.map((era) => (
        <button
          key={era.id}
          type="button"
          data-era={era.id}
          className={`era-picker__option ${selectedEraId === era.id ? 'era-picker__option--selected' : ''}`}
          onClick={() => onSelect(era.id)}
        >
          <span className="era-picker__option-label">
            <span className="era-picker__swatch" aria-hidden="true" />
            <strong>{era.name}</strong>
          </span>
          <span>{era.range}</span>
        </button>
      ))}
    </div>
  )
}
