# Plan: cut complexity

A review of the whole library for over-engineering, grouped by priority. Must
and Should are done, apart from one item that was tried and dropped. Could is
still open.

Estimated total: about 660 lines less. Must and Should together removed 417
lines net, so Could is what is left.

The line numbers in Could point at `terminal.tsx` as it was before any of this,
so they sit about 50 lines lower now.

## Must — pure deletions, no API change

Done. All of it was inside `terminal.tsx`, which went from 825 to 773 lines.
The suite still passes, 83 tests, and `tsc` and prettier are clean.

Still unproven outside happy-dom: `autoFocus` on mount, and the caret landing
at the end after writing `input.value`. Both need one click in a real browser.

- [x] **L97-106 `useFocus`.** A 10-line hook for focus on mount, plus a
      `setFocus()` after submit where focus never left the input. Replace with
      `autoFocus` on the input and a plain `useRef`. **Verified: 83/83 pass.**
- [x] **L513-520, 550, 565 `moveCursorToEnd`.** Assigning `input.value` already
      puts the caret at the end, so the `setTimeout(…, 0)` and
      `setSelectionRange` are not needed. **Verified: 83/83 pass.** Worth one
      click in a real browser before trusting happy-dom on this.
- [x] **L542-569 arrow keys.** ArrowUp and ArrowDown are the same 14 lines
      twice. One branch with `const step = e.key === 'ArrowUp' ? 1 : -1`, then
      `input.value = recallable.at(-1 - next)?.rawInput ?? ''`. About 8 lines.
- [x] **L645-659 last `clear`.** A hand-written reverse loop. Use
      `history.findLastIndex((h) => h.isClear)`.
- [x] **L92-95 `useIdCounter`.** A hook with one caller. Put
      `const counter = useRef(0)` inside `useTerminalHistory`.
- [x] **L108-122 `useScrollIntoView`.** Takes `dependency: any` and branches on
      `Array.isArray`, but is only ever called with an array. Take the array,
      check `items.length`, and the `any` disappears too.
- [x] **L635-643 `screenApi`.** Wrapped in `useMemo`, but its identity never
      reaches a dependency array or a memoised child. Plain object literal.
- [x] **L628, 791-795 `containerRef`.** Exists for one `querySelector`. Use
      `e.currentTarget.querySelector('input')?.focus()`.
- [x] **L165-168, 291 `RawFlag.dashes`.** Stored as a number only to be rebuilt
      as `'-'.repeat(flag.dashes)`. Store the string `'--'` or `'-'`.
- [x] **L522-582 null checks.** `if (commandInputRef.current)` five times. One
      `const input = commandInputRef.current; if (!input) return` at the top.

## Should

Done, except one item that was not worth its price (see below). About 400 lines
gone: the generated-app script (265) and the tab completion design (115) are
deleted, the two readmes became one (494 to 450), and the demo app is 206 lines
of real, editable files instead of heredocs.

- [x] **`create-app-for-quick-testing.sh` L19-261.** 240 lines of heredocs that
      generate `index.html`, `main.jsx`, `commands.jsx` and `vite.config.js`.
      The last change turned three real files into strings inside bash: no
      highlighting, no typecheck, no prettier, and no editing the demo while you
      use it. The script is gone: `demo/` is committed, and `npm run dev` is
      `npm run build && vite serve demo`.
- [x] **`tab-completion.md`.** 113 lines of design for a feature whose own
      "Recommended scope" section is about 30 lines of code, while `TODO.md`
      L35-39 already summarises it. Keep the scope list, drop the file.
- [x] **`readme.md` and `src/kanza/README.md`.** Two hand-written READMEs, 494
      lines together, documenting the same API. The root one is what npm and
      GitHub show, so the API docs moved there and `src/kanza/README.md` is
      deleted. A stub pointing at the other file is the kind of thing this pass
      removes.
- [ ] **`terminal.tsx` L263-275, the list grammar. Not done, on purpose.** Tried
      it: `names.join(', ')` turns
      `--name and --number both want -n` into `--name, --number want -n`. That
      string is in the readme and asserted by two tests, and it goes in the
      terminal where a user sees it, not only to the console. Six lines is not
      worth a worse message plus the doc and test churn. Reopen only if the
      message changes for another reason anyway.
- [x] **`terminal.tsx` L236-241, 269-276.** `buildShortForms` returned
      `{ longToShort: {}, shortToLong: {}, conflict }` in two places. Now one
      `conflict()` helper builds that shape. It keeps returning the empty maps,
      because `Help` calls `buildShortForms` and ignores `conflict`, so filling
      them would show short forms for a command that refuses to run.
- [x] **`terminal.tsx` L700-711.** `virtualCommands`, with two
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
