// Post-build step (see "build" in package.json): renders the home screen to
// static HTML and writes it into dist/index.html's #root.
//
// Why: the site is a single-page app, so the HTML Netlify serves is an empty
// shell until React runs. Google does render JS, but in a slower second pass,
// and other crawlers don't at all — so without this the page has no visible
// text to index. With it, the first byte of HTML already contains the h1, the
// era picker and the buttons; main.jsx then hydrates rather than re-rendering.
//
// Deliberately fails the build on any problem rather than shipping an
// unprerendered page silently: a failed deploy keeps the previous one live
// and is visible in Netlify, whereas a silent regression here would just
// quietly drop the site out of search results.
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const root = process.cwd()
const ssrOutDir = path.join(root, '.prerender')
const indexPath = path.join(root, 'dist', 'index.html')

// The empty root index.html ships with. Matched exactly so a stray attribute
// or whitespace change in index.html fails loudly here instead of producing a
// page with the prerender silently missing.
const EMPTY_ROOT = '<div id="root"></div>'

// A separate SSR build of just the entry, without the PWA plugin (it would
// try to emit a second service worker) and without touching dist/. Vite
// externalises node_modules in SSR mode, so the output is a small module that
// imports react from disk.
await build({
  configFile: false,
  root,
  logLevel: 'warn',
  plugins: [react()],
  build: {
    ssr: 'src/entry-server.jsx',
    outDir: ssrOutDir,
    emptyOutDir: true,
    minify: false,
  },
})

try {
  const { render } = await import(pathToFileURL(path.join(ssrOutDir, 'entry-server.js')).href)
  const appHtml = render()
  if (!appHtml.includes('<h1>')) {
    throw new Error('Prerendered home screen has no <h1> — is SetWord still the home route?')
  }

  const index = await readFile(indexPath, 'utf8')
  if (!index.includes(EMPTY_ROOT)) {
    throw new Error(`dist/index.html has no ${EMPTY_ROOT} to fill — check the <body> in index.html`)
  }

  await writeFile(indexPath, index.replace(EMPTY_ROOT, `<div id="root">${appHtml}</div>`))
  console.log(`prerender: wrote ${appHtml.length} bytes of home-screen HTML into dist/index.html`)
} finally {
  await rm(ssrOutDir, { recursive: true, force: true })
}
