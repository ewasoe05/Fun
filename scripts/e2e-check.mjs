import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const SHOTS = '/tmp/claude-0/-home-user-Fun/41195a9e-ffbb-53dd-8baf-9ae9d24e75b6/scratchpad/shots'
mkdirSync(SHOTS, { recursive: true })
const BASE = 'http://localhost:4173/Fun/'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  proxy: process.env.HTTPS_PROXY
    ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' }
    : undefined,
})
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  ignoreHTTPSErrors: true,
  permissions: ['notifications'],
})
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept())
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` })
const step = (s) => console.log(`\n== ${s}`)

// Chromium cannot tunnel HTTPS through this sandbox's egress proxy, so wger API
// calls are fulfilled with a real captured response (the live API shape + CORS
// were verified with curl). On a real device the app talks to wger.de directly.
const FIXTURE = process.env.WGER_FIXTURE
if (FIXTURE) {
  const { readFileSync } = await import('node:fs')
  await page.route('**wger.de/api/v2/exerciseinfo/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: readFileSync(FIXTURE, 'utf8') }),
  )
}

step('load app')
await page.goto(BASE)
await page.getByText('Start a workout').waitFor({ timeout: 15000 })

step('inject demo history into IndexedDB')
await page.evaluate(async () => {
  const open = () =>
    new Promise((res, rej) => {
      const req = indexedDB.open('liftlog')
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
  const idb = await open()
  const tx = idb.transaction(['workouts', 'settings'], 'readwrite')
  const workouts = tx.objectStore('workouts')
  const week = 7 * 24 * 3600 * 1000
  const now = Date.now()
  const mk = (i) => {
    const start = now - (8 - i) * week
    const set = (kg, reps) => ({ weightKg: kg, reps, done: true, completedAt: start + 1000 })
    const sets = (kg, reps) => [set(kg, reps), set(kg, reps), set(kg - 2.5, reps)]
    return {
      id: `demo-${i}`,
      startedAt: start,
      finishedAt: start + 55 * 60000,
      routineName: 'Full Body',
      entries: [
        { exerciseId: 'seed-bench-press', exerciseName: 'Bench Press', sets: sets(52.5 + i * 2.5, 8) },
        { exerciseId: 'seed-back-squat', exerciseName: 'Back Squat', sets: sets(70 + i * 5, 5) },
        { exerciseId: 'seed-deadlift', exerciseName: 'Deadlift', sets: [set(90 + i * 6, 5)] },
        { exerciseId: 'seed-overhead-press', exerciseName: 'Overhead Press', sets: sets(32.5 + i * 1.5, 8) },
        { exerciseId: 'seed-barbell-row', exerciseName: 'Barbell Row', sets: sets(50 + i * 2.5, 8) },
      ],
    }
  }
  for (let i = 1; i <= 8; i++) workouts.put(mk(i))
  tx.objectStore('settings').put({ id: 'main', units: 'lb', sex: 'male', bodyweightKg: 82, restSeconds: 90 })
  await new Promise((res, rej) => {
    tx.oncomplete = res
    tx.onerror = () => rej(tx.error)
  })
  idb.close()
})
await page.reload()
await page.getByText('Start a workout').waitFor()

step('create a routine')
await page.getByRole('link', { name: /Routines/ }).click()
await page.getByRole('button', { name: '+ New routine' }).click()
await page.locator('label:has-text("Routine name") input').waitFor()
await page.locator('label:has-text("Routine name") input').fill('Push Day')
await page.getByRole('button', { name: '+ Add exercise' }).click()
await page.getByPlaceholder('Search exercises…').fill('bench press')
await page.locator('.modal .list-item', { hasText: /^Bench Press/ }).first().click()
await page.getByRole('button', { name: '+ Add exercise' }).click()
await page.getByPlaceholder('Search exercises…').fill('overhead')
await page.locator('.modal .list-item', { hasText: 'Overhead Press' }).first().click()
await page.getByRole('button', { name: '+ Add exercise' }).click()
await page.getByPlaceholder('Search exercises…').fill('lateral')
await page.locator('.modal .list-item', { hasText: 'Lateral Raise' }).first().click()
await shot('3-routine-editor')
console.log('routine created with 3 exercises')

step('start workout from routine')
await page.getByRole('link', { name: /Workout/ }).click()
await page.locator('.list-item', { hasText: 'Push Day' }).click()
await page.getByText(/sets done/).waitFor()
// previous-session hints present for bench (from demo history)?
const firstPrev = await page.locator('.card').first().locator('.prev-hint').first().textContent()
console.log('bench previous hint:', JSON.stringify(firstPrev))
// prefilled weight from last session?
const prefill = await page.locator('.card').first().locator('.set-grid input').first().inputValue()
console.log('bench prefilled weight (lb):', prefill)
await shot('1-active-workout')

step('log sets + rest timer')
const firstRow = page.locator('.card').first().locator('.set-grid').filter({ has: page.locator('input') }).first()
await firstRow.locator('input').first().fill('165')
await firstRow.locator('input').nth(1).fill('8')
await firstRow.locator('.set-done-btn').click()
await page.locator('.rest-timer').waitFor()
await shot('2-rest-timer')
console.log('rest timer text:', (await page.locator('.rest-time').textContent()).trim())
await page.getByRole('button', { name: 'Skip' }).click()
// check off every remaining set
const buttons = page.locator('.set-done-btn:not(.done)')
while ((await buttons.count()) > 0) {
  await buttons.first().click()
  const timer = page.locator('.rest-timer')
  if (await timer.isVisible()) await page.getByRole('button', { name: 'Skip' }).click()
}
console.log('all sets checked')

step('finish workout')
await page.getByRole('button', { name: 'Finish' }).click()
await page.getByText('Start a workout').waitFor()
console.log('workout saved, back on start screen')

step('progress screen')
await page.getByRole('link', { name: /Progress/ }).click()
await page.getByText('Strength standards').waitFor()
await page.locator('.recharts-surface').first().waitFor()
console.log('selected exercise:', await page.locator('select').inputValue())
await shot('4-progress-1rm')
await page.getByRole('button', { name: 'Volume' }).click()
await page.locator('.recharts-surface').first().waitFor()
await shot('5-progress-volume')
const meters = await page.locator('.meter').count()
const standards = await page.locator('.card', { hasText: 'est. 1RM reaches' }).first().textContent()
console.log(`standards meters: ${meters}, first card:`, standards.replace(/\s+/g, ' ').slice(0, 120))

step('exercise detail')
await page.getByRole('link', { name: /Exercises/ }).click()
await page.getByPlaceholder('Search exercises…').fill('bench press')
await page.locator('.list-item', { hasText: /^Bench Press/ }).first().click()
await page.getByText('How to do it').waitFor()
await page.getByText('Watch form videos').waitFor()
await shot('6-exercise-detail')

step('wger online search (live internet)')
await page.getByRole('button', { name: '‹ Back' }).click()
await page.getByPlaceholder('Search exercises…').fill('kettlebell swing')
await page.getByRole('button', { name: /Search online/ }).click()
try {
  await page.locator('.list-item', { hasText: 'from wger.de' }).first().waitFor({ timeout: 30000 })
  const names = await page.locator('.list-item:has-text("from wger.de")').allTextContents()
  console.log('online results:', names.slice(0, 4).map((n) => n.replace(/\s+/g, ' ').trim()))
  await shot('7-online-search')
  await page.locator('.list-item', { hasText: 'from wger.de' }).first().click()
  await page.getByText(/wger.de \(CC-BY-SA\)/).waitFor()
  console.log('imported online exercise, detail page title:', await page.locator('h1').textContent())
  await shot('8-imported-exercise')
} catch (e) {
  console.log('ONLINE SEARCH FAILED:', e.message.split('\n')[0])
  await shot('7-online-search-FAILED')
}

step('settings + export')
await page.getByRole('link', { name: /Settings/ }).click()
await page.getByRole('heading', { name: 'Backup' }).waitFor()
await shot('9-settings')
const dl = page.waitForEvent('download', { timeout: 10000 })
await page.getByRole('button', { name: 'Export data' }).click()
const download = await dl
console.log('export filename:', download.suggestedFilename())
const path = await download.path()
const { readFileSync } = await import('node:fs')
const backup = JSON.parse(readFileSync(path, 'utf8'))
console.log('backup contents:', {
  exercises: backup.exercises.length,
  routines: backup.routines.length,
  workouts: backup.workouts.length,
})

step('offline check (block network, reload)')
// route interception makes Chromium bypass service workers — remove it first
await page.unroute('**wger.de/api/v2/exerciseinfo/**')
await page.goto(BASE)
try {
  await page.getByText('Start a workout').waitFor({ timeout: 15000 })
} catch {
  console.log('DEBUG url:', page.url())
  console.log('DEBUG body:', (await page.textContent('body').catch(() => 'N/A'))?.slice(0, 300))
  throw new Error('start screen missing after unroute reload')
}
// wait until the service worker controls the page and precaching is done
await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready
  for (let i = 0; i < 200 && !(reg.active?.state === 'activated' && navigator.serviceWorker.controller); i++)
    await new Promise((r) => setTimeout(r, 100))
  for (let i = 0; i < 200; i++) {
    const keys = await caches.keys()
    if (keys.length > 0 && (await (await caches.open(keys[0])).keys()).length >= 8) return
    await new Promise((r) => setTimeout(r, 100))
  }
})
await ctx.setOffline(true)
await page.reload()
await page.getByText('Start a workout').waitFor({ timeout: 15000 })
console.log('app shell loads offline ✔')
await ctx.setOffline(false)

console.log('\nERRORS:', errors.length ? errors : 'none')
await browser.close()
console.log('DONE')
