# Netera Duel — Project Spec

*Net + Era. Friend-vs-friend word duels, drawn from 25 years of internet slang.*

**Naming:** "Netera Duel" is canonical everywhere — code, domain, URLs, all copy. "NetEra" (internal capital) is a logo/wordmark-only stylisation, not used in running text.

## Concept

A Wordle-style word-guessing game, but every puzzle is set by a specific friend for a specific friend, drawn from a chosen era of internet culture. The invite *is* the distribution mechanic — you can't play without sending a link to someone.

## Core game loop

1. **Setter picks a word.** From a curated era-band word bank (browsing the list is the default experience; "random era" is a one-tap fast-path shortcut for anyone in a hurry). Adds an optional one-line hint. Gets a shareable link — no account required.
2. **Sends the link.** Open Graph tags on the link show a proper preview card ("Cam's challenged you to a word duel") rather than a bare URL.
3. **Guesser plays.** Sees the hint and the era band, then a standard Wordle-style grid: 6 guesses, green/yellow/grey per-letter feedback. No signup wall.
4. **The turn-back.** Immediately after finishing, the guesser is prompted to set their own word back at the setter. This is the single most important mechanic in the game — without it, it's a one-way novelty that dies after one open. With it, it's a persistent thread between two people.
5. **Head-to-head result.** Once both sides are solved: "You solved theirs in 3, they solved yours in 5 — you're up." Lightweight running tally per pair, tracked via link/local state, no login.
6. **Bystander share.** Each player can separately post their own spoiler-free result grid to a group chat — the secondary viral channel, pulling in a third player.

## Word length

No fixed tile count. Classic Wordle is 5 letters because it's one shared daily puzzle across millions of players — fairness demands consistency. This game doesn't have that constraint: every duel is a unique word one person chose for one other person. The grid sizes to whatever word was picked ("sus" = 3 tiles, "brainrot" = 8 tiles), same convention Wordle already uses of showing blank tiles before guessing starts.

Word length becomes a strategic lever: short words converge fast and are easy; long, gnarly ones are a deliberate way to maximise the gap between players.

## Word validation

**No dictionary validation.** Slang like "rizz" or "delulu" isn't in a standard dictionary. Instead: the setter picks from a **curated word bank per era band** — curation *is* the validation. This also means zero marginal AI/API cost per game played.

**v1 scope note:** single-token slang only. Multi-word phrases ("no cap," "on fleek," "ok boomer") don't fit a single-word grid — punt these for v1.

## Era bands (5, launch set)

| Band | Years | Name | Flavour |
|---|---|---|---|
| 1 | 2001–2005 | **Dial-Up Days** | Away messages, "brb," "n00b," Napster, dial-up screech |
| 2 | 2006–2010 | **The MySpace Sprawl** | Top 8 drama, Rickroll, "epic fail," LOLcats, iPhone launch |
| 3 | 2011–2015 | **Tumblr Dreams** | Reblog culture, Grumpy Cat, Doge, Harlem Shake, "YOLO," "on fleek" |
| 4 | 2016–2020 | **The Flex & Lockdown Years** | Fortnite dances, "OK Boomer," TikTok launch, lockdown doomscrolling |
| 5 | 2021–present | **Brainrot & Beyond** | Rizz, sigma, skibidi, "67," aura farming — deliberately open-ended |

Band 5 is intentionally never closed off — it absorbs new terms as they land, so the game never needs a content migration to stay current, just periodic top-ups to one band.

## Word bank sizing

Target **40–60 curated words per band** for v1 (roughly 200–300 total). Below ~25–30 per band, an engaged pair will hit repeats within days — the pool needs to survive combinatorics, not just look like "enough."

Don't build equal depth across all five bands before launch — this is a research/curation job, not a coding one. Ship each band solid enough not to feel thin, then expand whichever bands players actually gravitate to.

**Status:** the actual word list (~300 words total) is being researched separately. Pending review, then to be added to this doc/codebase in whatever form fits best.

## Open decisions (not yet locked)

- Whether the era band is always shown to the guesser as a hint, or whether the setter can hide it for a harder mode
- What happens to duels nobody ever plays their turn back on (current lean: let them die, not every open needs to convert)
- Whether to rate-limit duels per pair, or leave it open until real usage data suggests otherwise

## Tech stack

- **Frontend:** Lightweight static app (React or plain JS), PWA-capable — installable to home screen
- **Backend/state:** Supabase. One core table is close to sufficient: a `games` row per duel (unique slug, secret word, hint, era band, guesses, status, created_at). No accounts, no auth — possession of the link is the access control
- **Hosting/deploy:** GitHub → Netlify, auto-deploy on push
- **DNS:** Porkbun, via CNAME to Netlify — no Cloudflare, no nameserver handoff
- **Analytics:** Plausible

## Visual direction — "Scrapbook Self"

Base UI stays quiet and neutral throughout: warm paper-grey (`#EDE9E2`) background, near-black plum ink (`#211B22`) for text. The boldness is spent in one place — each era band carries its own accent "skin" when selected, rather than the whole app being visually loud everywhere:

| Band | Accent direction |
|---|---|
| Dial-Up Days | Slate teal |
| The MySpace Sprawl | Hot magenta-on-black |
| Tumblr Dreams | Dusty lavender |
| The Flex & Lockdown Years | Neon lime |
| Brainrot & Beyond | Clashing multicolour gradient |

Rationale: mirrors the actual history the game is drawing on — MySpace, Xanga, and Tumblr were all defined by garish, personal profile customisation. Picking an era becomes its own small visual moment rather than a plain dropdown. Wordle's green/yellow/grey feedback colours stay as-is within any skin — that's a legibility convention, not a themeable element.

## Monetisation & distribution (TBD)

Distribution is viral-first regardless of monetisation model — the invite-to-play requirement *is* the growth mechanism, not something bolted on after.

Monetisation itself isn't locked in. Current thinking leans toward a freemium/upgrade model — possibly cosmetic skins as a premium feature — rather than the one-off purchase model considered for the charity-tool concept. Needs more thought before v1 scoping.

## Build plan

- **Where:** Claude Code in VS Code — real files under git, tied to the actual deploy pipeline, terminal access for Supabase CLI etc. Chat/claude.ai was for planning; VS Code is for building.
- **Model:** Sonnet 5 as the default for most implementation. Opus 5 (or the `opusplan` alias, which auto-switches Opus for planning and Sonnet for execution) for the initial schema/architecture session specifically — the duel-state logic and DB schema are the one part worth the heavier model.