// Standalone <script> build: attaches window.Replikateur with an init() that mounts
// the Terminal into an element. The NPM package entry stays src/replikateur/index.ts.
import { createRoot, Root } from 'react-dom/client'
import { createElement } from 'react'
import { Terminal, TerminalProps } from './replikateur/terminal'

type InitOptions = TerminalProps & { target: string | Element }

const roots = new WeakMap<Element, Root>()

function init({ target, ...props }: InitOptions) {
  const element = typeof target === 'string' ? document.querySelector(target) : target
  if (!element) throw new Error(`Replikateur: target not found: ${String(target)}`)

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

const Replikateur = { init }
;(window as unknown as { Replikateur: typeof Replikateur }).Replikateur = Replikateur

export default Replikateur
