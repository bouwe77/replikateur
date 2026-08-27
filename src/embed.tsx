// Standalone <script> build: attaches window.Kanza with an init() that mounts
// the Terminal into an element. The NPM package entry stays src/kanza/index.ts.
import { createRoot, Root } from 'react-dom/client'
import { createElement } from 'react'
import { Terminal, TerminalProps } from './kanza/terminal'

type InitOptions = TerminalProps & { target: string | Element }

const roots = new WeakMap<Element, Root>()

function init({ target, ...props }: InitOptions) {
  const element = typeof target === 'string' ? document.querySelector(target) : target
  if (!element) throw new Error(`Kanza: target not found: ${String(target)}`)

  let root = roots.get(element)
  if (!root) {
    root = createRoot(element)
    roots.set(element, root)
  }

  const render = (p: TerminalProps) => root!.render(createElement(Terminal, p))
  render(props)

  return {
    update: (newProps: TerminalProps) => render(newProps),
    unmount: () => {
      root!.unmount()
      roots.delete(element)
    },
  }
}

const Kanza = { init }
;(window as unknown as { Kanza: typeof Kanza }).Kanza = Kanza

export default Kanza
