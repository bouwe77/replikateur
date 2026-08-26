# Design: screens

Status: built. This is the design behind it, and the questions it left open.
The API itself is documented in `README.md`, under "Screens".

## Context

Kanza is a REPL in the browser. A command's handler returns a `ReactNode`, and that
node becomes a line in the history. That covers output. It does not cover a command
that *takes over*: something that fills the terminal, stays there while you use it,
and gives the terminal back when you are done.

The idea started as "TUIs", because that is the first thing you want to put there.
That was too specific. Kanza does not care what you render. The generic feature is:

> **A command can put something else on the screen for a while. Closing it brings the
> terminal back exactly as it was.**

A TUI is one thing you can render there. A form, a chart, a game, a picture, an
`<iframe>` — Kanza should not know the difference.

## Why the library has to do it

Two parts of this cannot be built from outside `<Terminal>`. Everything else can.

1. **The prompt keeps the keyboard.** `CommandInput` renders a real, focused
   `<input>`. Anything you render that listens for keys — a `window` keydown
   listener, an input of its own — fights with it, and the prompt wins the focus.
   Nothing outside the library can put that input to sleep.
2. **The look has to stay.** All the styling lives on `.terminal` in
   `terminal.module.css`: black background, Menlo, 14px, white text. Something
   rendered *next to* `<Terminal>` instead of inside it has to copy that, and drifts
   the day Kanza gets theming. The point of the feature is that you never feel like
   you left the terminal.

Compare this to the nested REPL (`oompa` in `src/main.tsx`). That needed no library
support at all, because it only swaps two props and keeps using the prompt. A screen
is different precisely because it *removes* the prompt.

## The boundary

**Kanza owns the screen itself**, and nothing inside it. In real-terminal terms this
is the alternate screen: `smcup` and `rmcup`, what `vim` and `less` switch to.

Kanza's four jobs:

- Fill the terminal box with what you gave it, so it inherits the font and the colours.
- Put the prompt to sleep, so it cannot steal keys or focus.
- Keep the scrollback untouched while the screen is open.
- Give the prompt, the history and the focus back on close.

**You own everything inside the screen.** Layout, keys, focus, widgets, styling,
state. What you render is a plain React component. It gets an `onExit`-shaped prop
from you, and it never imports anything from Kanza.

Not in Kanza, on purpose: no widgets, no keybinding registry, no focus management, no
mouse policy, no theme tokens. What you render inherits `font-family` and `color`
through ordinary CSS inheritance, which is enough until Kanza actually has themes.

## The API

The handler gets a `screen` object. Kanza holds the state.

```tsx
const commands: Commands = {
  edit: {
    handle: ({ screen }) => screen.open(<Editor onExit={screen.close} />),
    help: { example: 'edit', description: 'Open the editor' },
  },
}
```

```ts
export type TerminalScreen = {
  open: (screen: ReactNode) => void
  close: () => void
}

export type CommandHandlerArgs = {
  rawInput: string
  input: string
  args: string[]
  flags: CommandFlags
  screen: TerminalScreen   // new
}
```

Three deliberate choices:

- **`screen`**, not `view` or `takeover`. It is the word real terminals use, and it
  says nothing about what you put there.
- **You wire the way out yourself.** Kanza hands `close` to the handler; you pass it
  into your component however you like. No context, no hook, no cloned elements.
  Kanza never reaches into your tree.
- **One screen at a time.** `open` while a screen is open replaces it. `close` always
  lands you back at the prompt, never one level up.

## Rules

| | While a screen is open |
|---|---|
| Prompt | Not rendered. It cannot receive keys or focus. |
| History | Untouched. Not rendered, not changed, not lost. |
| Keyboard | Kanza listens for nothing. Not even Ctrl+C. |
| Styling | The screen renders inside `.terminal` and inherits from it. `classes.screen` to override. |
| Welcome, `clear`, `help` | Unaffected. They are history concerns. |

And around it:

- The command that opened the screen still echoes in the history, so after closing you
  see `> edit` above where you left off. That is what a real shell does.
- `screen.open()` returns `void`, so the handler returns nothing and the line gets no
  response — the same as `no-response` today. A handler that opens a screen *and*
  returns a node is allowed: the node goes into the history, and you see it on close.
- An async handler can open a screen after awaiting. While it runs, the prompt is
  blocked as it is now, and the pending marker sits in the history behind the screen.
- `close()` with nothing open is a no-op.
- Opening the same screen twice mounts it fresh. Kanza keeps no state for you.

**There is no escape hatch.** If what you render has no way out, you are stuck, the
same as in a real terminal. Kanza taking Ctrl+C for itself would steal a key that the
thing on screen may well want.

## Left open on purpose

Not blockers. Worth deciding when there is a reason to.

- **Scroll position on return.** Hiding the history means the container's scroll
  position is lost, so closing probably lands you at the top of the scrollback rather
  than where you were. Only noticeable with a long history. See if it bothers you.
- **Opening from outside a command.** Today only a handler can open a screen. An app
  that wants to *start* in a screen has no way to say so. A prop would do it, and
  would fit the nested-REPL precedent, but nothing needs it yet.
- **Handing a value back.** `close()` takes nothing. A screen that wants to report a
  result (a picked file, a filled-in form) has to do it through your own state. If
  that turns out to be the common case, `close(node)` pushing a history line is the
  obvious next step.
- **Nesting.** Decided as "replace", but nothing can trigger it yet: only a command
  opens a screen, and while a screen is open there is no prompt to type one at.
  Revisit if opening from outside a command ever lands.

## How it turned out

Small, and all in `terminal.tsx`.

- `useState<ReactNode>` in `Terminal`, plus a stable `{ open, close }` object handed
  to every handler through the existing `cmdDef.handle({ ... })` call.
- When a screen is set, the JSX renders it instead of the welcome, the `HistoryList`,
  the `CommandInput` and the scroll anchor. `history` lives on `Terminal`, so it
  survives untouched, and `CommandInput`'s `useFocus` puts the focus back on the
  prompt when it remounts.
- The container's `onClick` focuses the first `input` it finds, so it is now skipped
  while a screen is open: that input could belong to you.
- One CSS rule so the screen fills the box, one entry in `TerminalClasses`, one type
  export.

The demo command is `menu` in `src/commands.tsx`, written by hand: Kanza must not
depend on a component library to show this off.
