// Re-encodes the per-era Open Graph images in public/og/ to a sane file size.
//
// Why this exists: OG images are fetched on the *scraper's* clock, not the
// user's. iMessage and WhatsApp give up early on a slow image, and a card that
// times out looks identical to one that was never configured — the failure is
// invisible to us and silent to whoever got the link. Artwork exported at
// maximum quality lands around 900 KB; the same image at quality 82 is closer
// to 150 KB with no visible difference at the size a chat client renders it.
//
//   npm run compress:og            re-encode anything above the threshold
//   npm run compress:og -- --force re-encode everything regardless
//
// Rewrites in place. Files already under the threshold are skipped by default
// rather than re-encoded, because JPEG is lossy in both directions: running
// this repeatedly over an already-compressed file degrades it a little each
// time. --force is there for when you've deliberately changed QUALITY.

import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const DIR = 'public/og'
const QUALITY = 82
const SKIP_UNDER_BYTES = 300 * 1024

// Must match ERA_IMAGE in netlify/edge-functions/og.js — the function declares
// these as og:image:width/height without measuring the file, so an image that
// isn't this size gets cropped or letterboxed by the scraper.
const EXPECTED = { width: 1200, height: 630 }

const force = process.argv.includes('--force')
const kb = (n) => `${(n / 1024).toFixed(0)} KB`

const files = (await fs.readdir(DIR)).filter((f) => /^era-\d+\.jpe?g$/i.test(f)).sort()

if (!files.length) {
  console.log(`No era-N.jpg files in ${DIR}/ — nothing to do.`)
  process.exit(0)
}

let totalBefore = 0
let totalAfter = 0
let warnings = 0

for (const file of files) {
  const full = path.join(DIR, file)
  const before = (await fs.stat(full)).size
  totalBefore += before

  // Read the bytes ourselves and hand sharp a buffer rather than a path. Given
  // a path, sharp keeps its own handle open on Windows long enough that the
  // writeFile below fails with UNKNOWN/EBUSY — and this repo lives in a
  // OneDrive folder, which is even quicker to lock a file it's syncing.
  const input = await fs.readFile(full)

  const meta = await sharp(input).metadata()
  if (meta.width !== EXPECTED.width || meta.height !== EXPECTED.height) {
    console.warn(
      `  ! ${file} is ${meta.width}x${meta.height}, expected ${EXPECTED.width}x${EXPECTED.height} — ` +
        `the edge function will declare the wrong dimensions for it`
    )
    warnings++
  }

  if (before < SKIP_UNDER_BYTES && !force) {
    console.log(`  · ${file.padEnd(11)} ${kb(before).padStart(8)}  already small, skipped`)
    totalAfter += before
    continue
  }

  // Encode to a buffer first and only write if it actually got smaller —
  // re-encoding an already-efficient file can make it bigger, and silently
  // growing the thing this script exists to shrink would be worse than a no-op.
  const buf = await sharp(input)
    .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
    .toBuffer()

  if (buf.length >= before) {
    console.log(`  · ${file.padEnd(11)} ${kb(before).padStart(8)}  already optimal, left alone`)
    totalAfter += before
    continue
  }

  await fs.writeFile(full, buf)
  totalAfter += buf.length
  const saved = (100 - (buf.length / before) * 100).toFixed(0)
  console.log(
    `  ✓ ${file.padEnd(11)} ${kb(before).padStart(8)} → ${kb(buf.length).padStart(8)}  (-${saved}%)`
  )
}

console.log(`\n  total      ${kb(totalBefore)} → ${kb(totalAfter)}`)
if (warnings) console.log(`  ${warnings} dimension warning(s) above — worth fixing at the source.`)
