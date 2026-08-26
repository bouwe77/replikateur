# Plan: cut complexity

A review of the whole library for over-engineering, grouped by priority. Nothing
here is applied yet. Two items are marked **verified**: the change was made in a
scratch copy and the full suite (83 tests) still passed.

Estimated total: about 660 lines less.

## Must — pure deletions, no API change

About 73 lines. All inside `terminal.tsx`.

- [ ] **L97-106 `useFocus`.** A 10-line hook for focus on mount, plus a
      `setFocus()` after submit where focus never left the input. Replace with
      `autoFocus` on the input and a plain `useRef`. **Verified: 83/83 pass.**
- [ ] **L513-520, 550, 565 `moveCursorToEnd`.** Assigning `input.value` already
      puts the caret at the end, so the `setTimeout(…, 0)` and
      `setSelectionRange` are not needed. **Verified: 83/83 pass.** Worth one
      click in a real browser before trusting happy-dom on this.
- [ ] **L542-569 arrow keys.** ArrowUp and ArrowDown are the same 14 lines
      twice. One branch with `const step = e.key === 'ArrowUp' ? 1 : -1`, then
      `input.value = recallable.at(-1 - next)?.rawInput ?? ''`. About 8 lines.
- [ ] **L645-659 last `clear`.** A hand-written reverse loop. Use
      `history.findLastIndex((h) => h.isClear)`.
- [ ] **L92-95 `useIdCounter`.** A hook with one caller. Put
      `const counter = useRef(0)` inside `useTerminalHistory`.
- [ ] **L108-122 `useScrollIntoView`.** Takes `dependency: any` and branches on
      `Array.isArray`, but is only ever called with an array. Take the array,
      check `items.length`, and the `any` disappears too.
- [ ] **L635-643 `screenApi`.** Wrapped in `useMemo`, but its identity never
      reaches a dependency array or a memoised child. Plain object literal.
- [ ] **L628, 791-795 `containerRef`.** Exists for one `querySelector`. Use
      `e.currentTarget.querySelector('input')?.focus()`.
- [ ] **L165-168, 291 `RawFlag.dashes`.** Stored as a number only to be rebuilt
      as `'-'.repeat(flag.dashes)`. Store the string `'--'` or `'-'`.
- [ ] **L522-582 null checks.** `if (commandInputRef.current)` five times. One
      `const input = commandInputRef.current; if (!input) return` at the top.

## Should

About 467 lines, most of it documentation and the dev script.

- [ ] **`create-app-for-quick-testing.sh` L19-261.** 240 lines of heredocs that
      generate `index.html`, `main.jsx`, `commands.jsx` and `vite.config.js`.
      The last change turned three real files into strings inside bash: no
      highlighting, no typecheck, no prettier, and no editing the demo while you
      use it. Commit a real `demo/` folder instead, so the script becomes
      `npm run build && cd demo && npm run dev`.
- [ ] **`tab-completion.md`.** 113 lines of design for a feature whose own
      "Recommended scope" section is about 30 lines of code, while `TODO.md`
      L35-39 already summarises it. Keep the scope list, drop the file.
- [ ] **`readme.md` and `src/kanza/README.md`.** Two hand-written READMEs, 494
      lines together, documenting the same API. Keep one, make the other a link.
- [ ] **`terminal.tsx` L263-275.** 13 lines of English list grammar (`both` vs
      `all`, comma-then-"and" joining) for a message that only ever goes to the
      console for a developer. Use `names.join(', ')`.
- [ ] **`terminal.tsx` L236-241, 269-276.** `buildShortForms` returns
      `{ longToShort: {}, shortToLong: {}, conflict }` in two places. Return
      `{ conflict }` alone and let `resolveFlags` bail out before it reads the
      maps.
- [ ] **`terminal.tsx` L700-711.** `virtualCommands`, with two
      `handle: () => {}` stubs, is rebuilt on every `help`. Module-level const.

## Could — worth a decision first

About 120 lines. These touch public API or a deliberate choice, so decide
before cutting.

- [ ] **`classes` prop.** `` `${styles.x} ${classes?.x || ''}` `` is written 16
      times, most of them wrapped over 3-5 lines by prettier. A helper
      `const cx = (k: keyof TerminalClasses) => …` saves about 25 lines. The
      bigger question: does `TerminalClasses` need all 17 keys? It has been
      public since 0.0.5, so this is the last cheap moment to ask.
- [ ] **L310-341 `commandProblems`.** Checks at runtime what the `Commands`
      type already forbids: empty name, space in the name, missing `handle`.
      Only the `short`-is-one-letter check is invisible to TypeScript. Keep the
      rest only if JavaScript users are a target, and say so in a comment.
- [ ] **L249-276 automatic short-form conflicts.** Two flags starting with the
      same letter block the whole command. First-come-wins would delete about 25
      lines and 2 tests. This was a deliberate choice, so only cut it if the
      strictness has never caught a real mistake.
- [ ] **L503-602 uncontrolled input.** The input is driven by writing `.value`
      in six places. One `useState` plus `value`/`onChange` removes the ref, the
      null checks and both cursor helpers. A bigger diff, but a smaller file.
- [ ] **L408, 457, 503 exports.** `HistoryList`, `Help` and `CommandInput` are
      exported. `index.ts` says this is "so the tests can reach it", but
      `terminal.test.tsx` imports only `Terminal`. Drop the keyword and fix the
      comment.
- [ ] **`terminal.module.css` L85-88.** `.scrollAnchor { float: left; clear:
      both }` on an empty div in a flex column. Float does nothing there.
- [ ] **`terminal.module.css` L1, L72-74.** A header comment naming a file that
      does not exist, and `.cursor:focus { outline: none }` repeating what
      `.cursor` already sets.
- [ ] **`tsconfig.node.json`.** A whole composite project plus a `references`
      entry so `tsc` can see one file. Use
      `"include": ["src", "vite.config.ts"]` in `tsconfig.json`.
- [ ] **`publish.sh` L14-15.** `npm install` on every publish. The comment
      already calls it optional.

## Won't

`terminal.test.tsx`, 1283 lines and 83 tests. A published library earns them,
and correctness checks are out of scope for this pass.
