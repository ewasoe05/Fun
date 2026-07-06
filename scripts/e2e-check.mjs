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

// Chromium cannot tunnel HTTPS through this sandbox's egress proxy, so external
// API calls are fulfilled with real captured responses (live API shapes + CORS
// were verified with curl). On a real device the app talks to the APIs directly.
const { readFileSync, existsSync } = await import('node:fs')
const FIXTURE = process.env.WGER_FIXTURE
if (FIXTURE) {
  await page.route('**wger.de/api/v2/exerciseinfo/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: readFileSync(FIXTURE, 'utf8') }),
  )
}
const FIX_DIR = process.env.FIXTURE_DIR
const foodFixtures = FIX_DIR && existsSync(`${FIX_DIR}/fix-off-search.json`)
if (foodFixtures) {
  const json = (name) => readFileSync(`${FIX_DIR}/${name}`, 'utf8')
  await page.route('**world.openfoodfacts.org/cgi/search.pl*', (route) =>
    route.fulfill({ contentType: 'application/json', body: json('fix-off-search.json') }),
  )
  await page.route('**world.openfoodfacts.org/api/v2/product/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: json('fix-off-barcode.json') }),
  )
  await page.route('**themealdb.com/api/**', (route) => {
    const url = route.request().url()
    if (url.includes('random.php')) {
      const first = JSON.parse(json('fix-mealdb-search.json')).meals[0]
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meals: [first] }) })
    }
    return route.fulfill({ contentType: 'application/json', body: json('fix-mealdb-search.json') })
  })
}

step('load app')
await page.goto(BASE)
await page.getByText('Start empty workout').waitFor({ timeout: 15000 })

step('inject demo history into IndexedDB')
await page.evaluate(async () => {
  const open = () =>
    new Promise((res, rej) => {
      const req = indexedDB.open('liftlog')
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
  const idb = await open()
  const tx = idb.transaction(['workouts', 'settings', 'foodLogs'], 'readwrite')
  const foodLogs = tx.objectStore('foodLogs')
  // a week of prior calorie history so the 14-day chart renders
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    foodLogs.put({
      id: `demo-food-${i}`,
      date: key,
      meal: 'dinner',
      name: 'Demo meal',
      grams: 500,
      kcal: 1800 + (i % 4) * 220,
      protein: 120,
      carbs: 180,
      fat: 60,
      loggedAt: d.getTime(),
    })
  }
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
await page.getByText('Start empty workout').waitFor()

step('dashboard')
await page.getByText(/Good (morning|afternoon|evening)|Night session/).waitFor()
await page.locator('.heatmap').waitFor()
const statValues = await page.locator('.stat-row .value').allTextContents()
console.log('this-week stats (workouts/sets/volume):', statValues)
await shot('0-dashboard')

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
console.log('rest timer text:', (await page.locator('.rest-timer .ring-center').textContent()).trim())
// 165 lb × 8 beats the demo history's best bench (est. 1RM) → PR trophy + confetti
await page.locator('.set-grid .pr-flash').first().waitFor({ timeout: 5000 })
console.log('PR trophy shown on the set ✔')
await page.getByRole('button', { name: 'Skip' }).click()

step('plate calculator')
await page.locator('.card').first().getByRole('button', { name: 'Plate calculator' }).click()
await page.getByText('Per side:').waitFor()
const plates = await page.locator('.modal .card .row-between').allTextContents()
console.log('plates for 165 lb:', plates.map((p) => p.replace(/\s+/g, ' ').trim()))
await shot('2b-plate-calculator')
await page.getByRole('button', { name: 'Close' }).click()
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
await page.getByText('Start empty workout').waitFor()
console.log('workout saved, back on start screen')

step('progress screen')
await page.getByRole('link', { name: /Progress/ }).click()
await page.getByRole('heading', { name: 'Strength standards' }).waitFor()
await page.locator('.recharts-surface').first().waitFor()
console.log('selected exercise:', await page.locator('select').inputValue())
await shot('4-progress-1rm')
await page.getByRole('button', { name: 'Volume' }).click()
await page.locator('.recharts-surface').first().waitFor()
await shot('5-progress-volume')
const meters = await page.locator('.meter').count()
const standards = await page.locator('.card', { hasText: 'est. 1RM reaches' }).first().textContent()
console.log(`standards meters: ${meters}, first card:`, standards.replace(/\s+/g, ' ').slice(0, 120))

step('bodyweight log')
await page.getByRole('button', { name: 'Log weight' }).click()
const bwInput = page.locator('label:has-text("Today\'s weight") input')
console.log('bodyweight prefill (lb):', await bwInput.inputValue())
await bwInput.fill('181')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.locator('.card', { hasText: 'Log weight' }).getByText('181 lb').waitFor()
console.log('bodyweight logged ✔')

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

if (foodFixtures) {
  step('nutrition settings + TDEE calculator')
  await page.getByRole('link', { name: /Settings/ }).click()
  await page.getByRole('heading', { name: 'Nutrition' }).waitFor()
  await page.locator('label:has-text("Height (cm)") input').fill('180')
  await page.locator('label:has-text("Birth year") input').fill('1998')
  await page.locator('label:has-text("Activity level") select').selectOption('moderate')
  await page.locator('label:has-text("Goal") select').selectOption('cut')
  await page.getByRole('button', { name: 'Calculate suggested targets' }).click()
  await page.getByText(/Suggested: \d+ kcal/).waitFor()
  // the live-query re-render can lag the click by a tick
  await page.waitForFunction(
    () => [...document.querySelectorAll('label')].some((l) => l.textContent.includes('kcal target') && l.querySelector('input')?.value),
  )
  const kcalTarget = await page.locator('label:has-text("kcal target") input').inputValue()
  console.log('calculated kcal target:', kcalTarget)

  step('diary: log food via online search')
  await page.locator('.bottom-nav').getByRole('link', { name: 'Food' }).click()
  await page.getByText('Set your calorie & macro targets', { exact: false }).waitFor({ state: 'hidden' }).catch(() => {})
  await page.locator('.card', { hasText: 'Breakfast' }).getByRole('button', { name: '+ Add food' }).click()
  await page.getByPlaceholder('Search foods…').fill('greek yogurt')
  await page.getByRole('button', { name: /Search online/ }).click()
  await page.locator('.list-item', { hasText: 'Open Food Facts' }).first().click()
  await page.getByRole('heading', { name: 'How much?' }).or(page.getByText('How much?')).first().waitFor()
  await shot('10-food-portion')
  await page.locator('label:has-text("Amount (grams)") input').fill('170')
  await page.getByRole('button', { name: 'Add to diary' }).click()
  const breakfastKcal = await page.locator('.card', { hasText: 'Breakfast' }).locator('.muted.small').first().textContent()
  console.log('breakfast subtotal:', breakfastKcal?.trim())

  step('diary: quick add')
  await page.locator('.card', { hasText: 'Lunch' }).getByRole('button', { name: '+ Add food' }).click()
  await page.getByRole('button', { name: 'Quick add', exact: true }).click()
  await page.locator('label:has-text("Calories (kcal)") input').fill('350')
  await page.locator('label:has-text("Protein (g)") input').fill('30')
  await page.getByRole('button', { name: 'Add to diary' }).click()

  step('diary: barcode manual lookup')
  await page.locator('.card', { hasText: 'Dinner' }).getByRole('button', { name: '+ Add food' }).click()
  await page.getByRole('button', { name: 'Scan', exact: true }).click()
  await page.getByPlaceholder('e.g. 0894700010137').fill('0894700010137')
  await page.getByRole('button', { name: 'Look up' }).click()
  await page.getByText('Greek Yogurt Nonfat Plain').first().waitFor()
  await page.getByRole('button', { name: '1 serving' }).click()
  await page.getByRole('button', { name: 'Add to diary' }).click()
  await page.locator('.ring-wrap').first().waitFor()
  await page.getByText(/Last 14 days \(kcal\)/).waitFor()
  console.log('calorie ring + 14-day history chart render ✔')
  await shot('11-food-diary')

  step('recipes: search, save, add to plan')
  await page.getByRole('button', { name: 'Recipes', exact: true }).click()
  await page.getByPlaceholder(/Search recipes/).fill('chicken curry')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.locator('.recipe-card').first().waitFor()
  await shot('12-recipes-results')
  await page.locator('.recipe-card').first().click()
  await page.getByRole('heading', { name: 'Ingredients' }).waitFor()
  await shot('13-recipe-detail')
  await page.getByRole('button', { name: 'Save to cookbook' }).click()
  await page.getByRole('button', { name: 'Saved — remove' }).waitFor()
  await page.getByRole('button', { name: 'Add to plan' }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await page.getByText('Added to your meal plan ✔').waitFor()

  step('meal plan week view')
  await page.getByRole('button', { name: '‹ Back' }).click()
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByText('Katsu Chicken curry').first().waitFor()
  console.log('plan shows the saved recipe on today ✔')
  await shot('14-meal-plan')
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
const backup = JSON.parse(readFileSync(path, 'utf8'))
console.log('backup contents:', {
  exercises: backup.exercises.length,
  routines: backup.routines.length,
  workouts: backup.workouts.length,
  foods: backup.foods?.length,
  foodLogs: backup.foodLogs?.length,
  recipes: backup.recipes?.length,
  planEntries: backup.planEntries?.length,
})

step('offline check (block network, reload)')
// route interception makes Chromium bypass service workers — remove it first
await page.unroute('**wger.de/api/v2/exerciseinfo/**')
await page.goto(BASE)
try {
  await page.getByText('Start empty workout').waitFor({ timeout: 15000 })
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
await page.getByText('Start empty workout').waitFor({ timeout: 15000 })
console.log('app shell loads offline ✔')
await ctx.setOffline(false)

console.log('\nERRORS:', errors.length ? errors : 'none')
await browser.close()
console.log('DONE')
