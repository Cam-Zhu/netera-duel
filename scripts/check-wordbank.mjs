// Pre-build check on the word bank (see "build" in package.json).
//
// The guess input in Guess.jsx and SoloPlay.jsx strips everything outside
// [a-zA-Z0-9-], and submit_guess lowercases before comparing, so any word
// outside ^[a-z0-9-]+$ can never be typed and is unwinnable — "tl;dr" shipped
// that way. Fail the build rather than let it happen again. Also fails on a
// duplicate word (two entries collide in SetWord's list keys and the era
// bridge) and when the root research copy has drifted from the app copy —
// both are hand-synced with no build link between them.
import { readFile } from 'node:fs/promises'

const APP_COPY = 'src/data/wordbank.json'
const ROOT_COPY = 'word-bank.json'
const ALLOWED = /^[a-z0-9-]+$/

const [app, root] = await Promise.all([readFile(APP_COPY, 'utf8'), readFile(ROOT_COPY, 'utf8')])
const problems = []

if (app !== root) problems.push(`${ROOT_COPY} is not byte-identical to ${APP_COPY} — edit both`)

const seen = new Set()
for (const { word, era } of JSON.parse(app).words) {
  if (!ALLOWED.test(word)) problems.push(`"${word}" (${era}) has characters the guess input can't accept`)
  if (seen.has(word)) problems.push(`"${word}" appears more than once`)
  seen.add(word)
}

if (problems.length) {
  console.error(`check-wordbank: ${problems.length} problem(s)\n  - ${problems.join('\n  - ')}`)
  process.exit(1)
}
console.log(`check-wordbank: ${seen.size} words OK`)
