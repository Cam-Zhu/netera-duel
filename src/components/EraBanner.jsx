// The banner artwork that sits above a word list, or above a choice of era.
//
// Two callers, one shape. SetWord passes an era and gets that era's artwork.
// SoloPlay's era picker passes `src` directly and gets the five-era banner,
// which belongs to no single band and so has no `order` to be keyed by.
//
// Purely decorative either way: alt is empty on purpose, because whatever the
// image says is already live text beside it — the era's name directly above on
// the word-picker screen, and all five era names in the buttons directly below
// in solo. If this ever carries information that text doesn't, it needs real
// alt text instead.
//
// Per-era files are keyed by era.order (the smallint 1-5 the DB also uses for
// era_band), not the era's string id — same convention as the share cards they
// sit alongside in public/og/.
export default function EraBanner({ era, src }) {
  const source = src ?? (era ? `/og/banner-${era.order}.jpg` : null)
  if (!source) return null

  return (
    <img
      className="era-banner"
      src={source}
      alt=""
      width={1200}
      height={400}
    />
  )
}
