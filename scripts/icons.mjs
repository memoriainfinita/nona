// Renders the PNG icons of the web app manifest from public/icon.svg with Playwright Firefox.
// Run after changing the icon: node scripts/icons.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { firefox } from 'playwright'

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8').then((s) => s.trim())
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
const tile = '#1B1E1D'

// Full-bleed square for platforms that apply their own mask. The grid is scaled so its corners
// stay inside the maskable safe zone (a centered circle of radius 40%).
function fullBleed(gridScale) {
  const grid = inner.replace(/^<rect[^>]*\/>/, '')
  const offset = 24 * (1 - gridScale)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${tile}"/><g transform="translate(${offset} ${offset}) scale(${gridScale})">${grid}</g></svg>`
}

const icons = [
  { file: 'pwa-192.png', size: 192, svg },
  { file: 'pwa-512.png', size: 512, svg },
  { file: 'maskable-512.png', size: 512, svg: fullBleed(0.8) },
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed(0.9) },
]

// Drawn on a canvas in the page: Firefox screenshots can't keep a transparent background.
const browser = await firefox.launch()
const page = await browser.newPage()
for (const icon of icons) {
  const png = await page.evaluate(async ({ svg, size }) => {
    const img = new Image(size, size)
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svg)
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    canvas.getContext('2d').drawImage(img, 0, 0, size, size)
    return canvas.toDataURL('image/png').split(',')[1]
  }, icon)
  await writeFile(fileURLToPath(new URL(`../public/${icon.file}`, import.meta.url)), Buffer.from(png, 'base64'))
  console.log(icon.file)
}
await browser.close()
