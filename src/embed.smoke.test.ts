import { existsSync, readFileSync } from 'fs'
import { test, expect } from 'vitest'

// Needs `npm run build:embed` first.
test.skipIf(!existsSync('dist/kanza.embed.js'))('embed bundle mounts, updates and unmounts', async () => {
  // eslint-disable-next-line no-eval
  ;(0, eval)(readFileSync('dist/kanza.embed.js', 'utf8'))
  document.body.innerHTML = '<div id="t"></div>'
  const el = document.querySelector('#t')!
  const api = (window as any).Kanza
  const handle = api.init({ target: '#t', prompt: '>>', commands: {} })
  await new Promise((r) => setTimeout(r, 100))
  expect(el.innerHTML.length).toBeGreaterThan(0)
  expect(document.head.innerHTML).toContain('<style')
  handle.update({ prompt: '%%', commands: {} })
  await new Promise((r) => setTimeout(r, 100))
  expect(el.textContent).toContain('%%')
  handle.unmount()
  await new Promise((r) => setTimeout(r, 100))
  expect(el.innerHTML).toBe('')
})
