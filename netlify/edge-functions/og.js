// Per-duel Open Graph tags for /d/<slug>.
//
// Link-unfurling crawlers (iMessage, WhatsApp, Slack, Facebook, Discord) fetch
// the HTML and never run JS, so the React app can't set these — index.html ships
// a static site-wide card and this function rewrites it per duel on the way out.
//
// It also does the three things a duel URL needs that the home page doesn't:
// strips the prerendered home screen out of #root, marks the page noindex,
// and returns 404 for a slug that doesn't exist (see stripPrerender,
// addNoindex and fetchDuelOg below).
//
// Declared for /d/* in netlify.toml. Edge functions run ahead of the SPA
// redirect, so context.next() returns the same index.html a browser would get.
//
// Design rule throughout: a preview card is decoration. Anything that goes
// wrong here — slug not found, Supabase slow or down, missing image, an
// outright exception — falls back to the unmodified static HTML rather than
// erroring, because a plain branded card still works and a 500 means the
// crawler shows a bare URL (or worse, the guesser's browser gets nothing).

// Era id/name/range triples, duplicated from src/data/wordbank.json. Edge
// functions run in Deno outside the Vite bundle, so they can't import it —
// if the era names there ever change, change them here too.
const ERAS = [
  { band: 1, id: 'dial-up-days', name: 'Dial-Up Days', range: '2001-2005' },
  { band: 2, id: 'myspace-sprawl', name: 'The MySpace Sprawl', range: '2006-2010' },
  { band: 3, id: 'tumblr-dreams', name: 'Tumblr Dreams', range: '2011-2015' },
  { band: 4, id: 'flex-lockdown', name: 'The Flex & Lockdown Years', range: '2016-2020' },
  { band: 5, id: 'brainrot-beyond', name: 'Brainrot & Beyond', range: '2021-present' },
]

// The per-era art and the site-wide fallback are deliberately different shapes:
// the era cards are 1200x630 (the 1.91:1 ratio Facebook/LinkedIn document and
// every scraper crops toward), while og-image.png predates them at 1536x1024.
// index.html can only declare one pair of dimensions, so whichever image we
// pick, its dimensions get written alongside it — a card whose declared size
// doesn't match the file gets letterboxed or cropped by the scraper.
const ERA_IMAGE = { ext: 'jpg', width: '1200', height: '630' }
const FALLBACK_IMAGE = { path: '/og-image.png', width: '1536', height: '1024' }

const GENERIC_TITLE = "You've been challenged to a word duel"
const GENERIC_DESCRIPTION = 'Six guesses at one word. Can you get it?'

const MAX_NAME_LENGTH = 30
const RPC_TIMEOUT_MS = 2000

// setter_name is free text somebody typed into a form and it lands inside an
// HTML attribute. React escapes nothing for us out here — this is raw string
// concatenation into a document — so escape it by hand. Escaping the quotes
// matters most: an unescaped " would close the content attribute and let the
// rest of the name become markup.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Truncate before escaping, so the cap can't slice an entity in half.
function cleanName(raw) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().slice(0, MAX_NAME_LENGTH).trim()
  return trimmed ? escapeHtml(trimmed) : null
}

// Title for a finished duel's card. `count` comes from get_duel_og's
// guess_count (migration 0009); if the edge function is ever deployed ahead
// of that migration it's undefined, and the title just drops the number
// rather than reading "solved in undefined guesses".
function resultTitle(name, status, count) {
  const whose = name ? `${name}'s word` : 'A word duel'
  if (status === 'won') {
    const guesses = Number.isInteger(count) ? ` in ${count} ${count === 1 ? 'guess' : 'guesses'}` : ''
    return `${whose} — solved${guesses}`
  }
  if (status === 'lost') return `${whose} — not solved in six`
  return `${whose} — never finished`
}

// Rewrite the content="" of whichever <meta> carries the given key. Matching the
// whole tag first, then the content attribute inside it, keeps this working
// regardless of attribute order — a build step that reshuffles them shouldn't
// silently turn this into a no-op.
function setMeta(html, attrName, key, value) {
  const tag = new RegExp(`<meta\\b[^>]*\\b${attrName}=["']${key}["'][^>]*>`, 'i')
  return html.replace(tag, (match) =>
    match.replace(/(\bcontent\s*=\s*")[^"]*(")/i, `$1${value}$2`)
  )
}

function setTitle(html, value) {
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${value}</title>`)
}

// dist/index.html carries the home screen prerendered into #root (see
// scripts/prerender.mjs) so search engines have text to index. On a duel URL
// that's the wrong screen — a guesser would see "Set a word" for the instant
// before React mounts — so hand them the empty shell instead. The lazy match
// runs to the first </div> that's followed by the <noscript> (or </body>)
// index.html puts after the root, which is the root's own closing tag
// however deeply nested the prerender is. No-op if the root is already empty.
function stripPrerender(html) {
  return html.replace(
    /<div id="root">[\s\S]*?<\/div>(?=\s*(?:<noscript>|<\/body>))/i,
    '<div id="root"></div>'
  )
}

// Every duel link is a thin near-copy of the home page, and there could be
// thousands of them — none should be indexed, and none should surface
// "<name>'s challenged you" in a search result. netlify.toml sends the same
// signal as an X-Robots-Tag header; the meta tag is belt-and-braces for the
// HTML body itself. Link unfurlers ignore robots directives, so the preview
// card is unaffected.
function addNoindex(html) {
  return html.replace(/<\/head>/i, '    <meta name="robots" content="noindex" />\n  </head>')
}

// A missing /og/era-N.jpg does NOT 404 here: the SPA catch-all redirect in
// netlify.toml would serve index.html at status 200 instead, and handing a
// crawler an HTML document as its og:image produces a visibly broken card. So
// check the content type, not just res.ok. Memoised per isolate — the answer
// only changes on deploy, and deploys start fresh isolates.
const imageChecks = new Map()

function imageIsReal(url) {
  if (!imageChecks.has(url)) {
    imageChecks.set(
      url,
      (async () => {
        try {
          const res = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
          })
          const type = res.headers.get('content-type') || ''
          return res.ok && type.startsWith('image/')
        } catch {
          return false
        }
      })()
    )
  }
  return imageChecks.get(url)
}

async function pickImage(origin, era, hideEraBand) {
  // No era art when the band is hidden — the image would give away the one
  // thing the setter chose to withhold.
  if (era && !hideEraBand) {
    const url = `${origin}/og/era-${era.band}.${ERA_IMAGE.ext}`
    if (await imageIsReal(url)) {
      return { url, width: ERA_IMAGE.width, height: ERA_IMAGE.height }
    }
  }
  return {
    url: `${origin}${FALLBACK_IMAGE.path}`,
    width: FALLBACK_IMAGE.width,
    height: FALLBACK_IMAGE.height,
  }
}

// Three outcomes, and the caller treats them differently: the duel row; null
// when Supabase answered and the slug definitely doesn't exist (the page
// should 404 so search engines don't log a soft-404 for every dead link); or
// undefined when we couldn't find out (no env, non-2xx), in which case the
// page keeps its normal status. A timeout throws and is caught by the caller.
async function fetchDuelOg(slug) {
  const base = Netlify.env.get('SUPABASE_URL')
  const key = Netlify.env.get('SUPABASE_ANON_KEY')
  if (!base || !key) return undefined

  const res = await fetch(`${base.replace(/\/$/, '')}/rest/v1/rpc/get_duel_og`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ p_slug: slug }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  })

  if (!res.ok) return undefined
  const rows = await res.json()
  if (!Array.isArray(rows)) return undefined
  return rows.length ? rows[0] : null
}

export default async (request, context) => {
  const res = await context.next()

  // Anything that isn't the HTML shell (an asset, a redirect) passes straight
  // through untouched, body unread.
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res

  let html
  try {
    html = await res.text()
  } catch {
    return res
  }

  // Past this point the body is consumed, so every exit rebuilds a Response
  // from `html` — worst case that's the static page minus the home-screen
  // prerender, which is the right shape for any duel URL regardless of what
  // happens below.
  html = addNoindex(stripPrerender(html))
  let status = res.status

  try {
    const url = new URL(request.url)
    const slug = decodeURIComponent(url.pathname.match(/^\/d\/([^/]+)\/?$/)?.[1] ?? '')

    // Slugs are 8 lowercase alphanumerics from generate_slug(); the loose guard
    // leaves room for that to change while still rejecting junk paths outright
    // rather than spending a Supabase round trip on them.
    if (/^[A-Za-z0-9_-]{1,64}$/.test(slug)) {
      const duel = await fetchDuelOg(slug)

      // Same HTML, honest status: the SPA still loads and shows its own
      // not-found state, but crawlers stop treating dead links as duplicate
      // pages that happen to return 200.
      if (duel === null) status = 404

      // A pending duel unfurls as a challenge; a finished one (won/lost/
      // expired) as a result — the link people post from the result share
      // leads to the spectator view (migration 0009), so it should read as
      // "look what happened" rather than a fresh invitation, and not as the
      // bland site-wide card either. Never the hint or the word in either.
      if (duel) {
        const era = ERAS.find((e) => e.band === duel.era_band) ?? null
        const showEra = Boolean(era) && !duel.hide_era_band
        const name = cleanName(duel.setter_name)
        const pending = duel.status === 'pending'

        const title = pending
          ? name
            ? `${name}'s challenged you to a word duel`
            : GENERIC_TITLE
          : resultTitle(name, duel.status, duel.guess_count)
        const description = pending
          ? showEra
            ? `${era.name} (${era.range}). Six guesses. Can you get it?`
            : GENERIC_DESCRIPTION
          : showEra
            ? `${era.name} (${era.range}). Think you'd do better?`
            : "Think you'd do better?"
        const image = await pickImage(url.origin, era, duel.hide_era_band)

        html = setTitle(html, title)
        html = setMeta(html, 'name', 'description', description)
        html = setMeta(html, 'property', 'og:title', title)
        html = setMeta(html, 'property', 'og:description', description)
        html = setMeta(html, 'property', 'og:image', image.url)
        html = setMeta(html, 'property', 'og:image:width', image.width)
        html = setMeta(html, 'property', 'og:image:height', image.height)
        html = setMeta(html, 'property', 'og:url', `${url.origin}/d/${slug}`)
        html = setMeta(html, 'name', 'twitter:title', title)
        html = setMeta(html, 'name', 'twitter:description', description)
        html = setMeta(html, 'name', 'twitter:image', image.url)
      }
    }
  } catch {
    // Fall through with whatever `html` holds — the untouched static page.
  }

  // Rebuild the headers rather than reusing the originals wholesale: the body
  // length has changed, and a stale content-length or content-encoding would
  // truncate or garble the response.
  const headers = new Headers(res.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')

  return new Response(html, {
    status,
    statusText: status === res.status ? res.statusText : 'Not Found',
    headers,
  })
}
