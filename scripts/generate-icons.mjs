// Renders the app icon SVG to the PNG sizes the PWA manifest needs.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c5cab"/>
      <stop offset="1" stop-color="#0d1e33"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <g stroke="#ffffff" stroke-linecap="round">
    <line x1="96" y1="256" x2="416" y2="256" stroke-width="28"/>
    <rect x="120" y="156" width="44" height="200" rx="14" fill="#ffffff" stroke="none"/>
    <rect x="348" y="156" width="44" height="200" rx="14" fill="#ffffff" stroke="none"/>
    <rect x="76" y="196" width="34" height="120" rx="12" fill="#3987e5" stroke="none"/>
    <rect x="402" y="196" width="34" height="120" rx="12" fill="#3987e5" stroke="none"/>
  </g>
</svg>`

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
})
const page = await browser.newPage()
for (const size of [512, 192, 180]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<style>*{margin:0}</style><div style="width:${size}px;height:${size}px">${svg.replace(
      '<svg ',
      `<svg width="${size}" height="${size}" `,
    )}</div>`,
  )
  await page.screenshot({ path: join(outDir, `icon-${size}.png`), omitBackground: true })
  console.log(`icon-${size}.png`)
}
await browser.close()
