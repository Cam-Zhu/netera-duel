// The era's artwork, shown once a band is picked and before a word is chosen.
//
// Purely decorative: alt is empty on purpose, because the era's name is already
// live text immediately above this and a screen reader announcing it twice adds
// nothing. If this ever carries information the name doesn't, it needs real alt
// text instead.
//
// Files are keyed by era.order (the smallint 1-5 the DB also uses for
// era_band), not the era's string id — same convention as the share cards they
// sit alongside in public/og/.
export default function EraBanner({ era }) {
  if (!era) return null

  return (
    <img
      className="era-banner"
      src={`/og/banner-${era.order}.jpg`}
      alt=""
      width={1200}
      height={400}
    />
  )
}
