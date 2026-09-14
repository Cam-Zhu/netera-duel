# Per-era Open Graph images

Drop five files in this folder:

```
era-1.jpg   Dial-Up Days              slate teal
era-2.jpg   The MySpace Sprawl        hot magenta on black
era-3.jpg   Tumblr Dreams             dusty lavender
era-4.jpg   The Flex & Lockdown Years neon lime
era-5.jpg   Brainrot & Beyond         clashing multicolour gradient
```

The number is `duels.era_band` (the smallint 1–5, matching `order` in
`src/data/wordbank.json`) — not the era's string id.

**1200 × 630, JPG.** That's the 1.91:1 ratio Facebook and LinkedIn document, and
what every scraper crops toward. The extension is load-bearing: the edge
function builds the path as `era-<band>.jpg`, so a `.png` here will be ignored
and that band will silently fall back. If you ever switch formats, change
`ERA_IMAGE.ext` in `netlify/edge-functions/og.js` to match.

Note these are a *different shape* from the site-wide `public/og-image.png`
(1536 × 1024). `index.html` can only declare one `og:image:width`/`height` pair,
so the edge function rewrites those two tags alongside `og:image` to match
whichever file it actually picked. Nothing to do here — just don't assume the
static values in `index.html` apply to these.

## After adding or replacing artwork, run this

```
npm run compress:og
```

Exports at full quality land around 900 KB each; at quality 82 the same image is
~120 KB with no visible difference at the size a chat client renders it. That
matters because OG images are fetched on the *scraper's* clock — iMessage and
WhatsApp give up early, and a card that times out looks identical to one that
was never configured, so the failure is invisible to you and silent to whoever
got the link.

The script skips anything already under 300 KB, so re-running it is safe and
won't degrade files through repeated JPEG passes. It also warns if an image
isn't 1200 × 630.

Until a file lands here, `netlify/edge-functions/og.js` quietly serves
`/og-image.png` instead — it HEAD-checks each era image once per edge isolate
and falls back if the response isn't really an image. So partial coverage is
fine: add two of the five and only those two bands get custom art. The fallback
is also used whenever the setter chose to hide the era band, since the artwork
would give away exactly what they hid.
