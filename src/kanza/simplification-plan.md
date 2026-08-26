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

## Could — decided one by one

All nine were discussed separately. Three were done, six were kept on purpose,
and in three of those the plan's own premise turned out to be wrong. That is the
useful result of this section: the cheap wins were in Must and Should, and what
is left here is mostly load-bearing.

Done:

- [x] **1a. `classes`, the repetition.** A `classNames(classes)` factory, bound
      once per component, so each site reads `cx('prompt')`. 777 to 757 lines.
- [x] **5. `export` on the internal components.** `HistoryList`, `Help` and
      `CommandInput` are no longer exported, and `index.ts` no longer claims
      they are exported for the tests. Checked first: `dist/kanza.d.ts` never
      contained them, and the test file imports only `Terminal`, `Commands` and
      `CommandHandlerArgs`.
- [x] **6 + 7. Three dead CSS rules.** `.scrollAnchor` kept its class but lost
      `float: left; clear: both`, which flexbox ignores on a flex item. The
      header comment naming a file that does not exist is gone, and so is
      `.cursor:focus { outline: none }`, which repeats what `.cursor` already
      sets in every state. The empty `.scrollAnchor` rule is dropped from
      `dist/kanza.css` by the build, but the class name mapping survives in the
      JS, so the public `classes.scrollAnchor` key still works.

Kept on purpose:

- [ ] **1b. The 17 `TerminalClasses` keys.** Public since 0.0.5 and documented
      as the whole styling story. Once `cx` exists, cutting keys saves no code,
      only type surface, and breaks anyone styling that part today.
- [ ] **2. `commandProblems`. The premise was wrong.** Of its six checks
      TypeScript catches two: a space in the name, and a missing `handle`. An
      empty name, a name starting with a dash, an untypeable flag name and a
      `short` that is not one letter are all invisible to it, and even those two
      only bite when the object is annotated or inline. Build commands
      dynamically and TypeScript sees nothing, which is exactly where these
      mistakes come from. It is a real diagnostic, with tests and a readme
      section, not duplicated validation.
- [ ] **3. Automatic short-form conflicts.** First-come-wins would save about 20
      lines but replaces a loud error with a silent wrong value: `add -n Bob`
      would set `name` instead of `number`, decided by key order in the object
      literal. A middle option was considered and dropped too: keep the
      detection, drop the refusal, and only `console.error` it.
- [ ] **4. The uncontrolled input.** The Must items already took this from six
      `.value` touches to four, so going controlled is now a wash in lines. It
      would also mean keeping a ref anyway, because tab completion needs
      `selectionStart`, which only exists on the element. Revisit if tab
      completion wants the line in state.
- [ ] **8. `tsconfig.node.json`.** Left as it is. Worth knowing what was found:
      a `references` entry is only followed by `tsc -b`, and `npm run build`
      runs plain `tsc`, so `vite.config.ts` is not typechecked at all today, and
      that second config could not do it anyway (no `skipLibCheck`, no `lib`, no
      `target`, and `moduleResolution: "Node"` cannot read the types of
      `@vitejs/plugin-react`). The plan's one-line fix does not work for the same
      reason. What did work, verified and then reverted: the `bundler`
      resolution setting, a single `include: ["src", "vite.config.ts"]`, and
      `entry: 'src/kanza/index.ts'` instead of `resolve(__dirname, …)`. That is
      -11 lines with `tsc` silent, the build fine, the tests passing and `dist`
      identical. Reopen from here if the config ever needs to be trusted.
      Loose end: `tsconfig.node.tsbuildinfo` is untracked in the repo root and
      nothing regenerates it.
- [ ] **9. `npm install` in `publish.sh`.** Kept, and the comment no longer
      calls itself optional. It is a release script: a second of install
      prevents a publish that builds against stale dependencies, and a bad
      release cannot be taken back, because the version is bumped, the tag is
      pushed and npm refuses to republish a version. `npm ci` would be a
      stronger check but reinstalls from scratch every time.

## Where this ended up

| Pass   | Result                                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Must   | 10 of 10 done. `terminal.tsx` 825 to 773.                                                                                               |
| Should | 5 of 6 done, about 400 lines gone. The list grammar was tried and dropped: it is a user-facing message, in the readme and in two tests. |
| Could  | 3 of 9 done. Six kept, three of those because the finding itself was wrong.                                                             |

`terminal.tsx` is 757 lines, from 825. The two readmes are one file of 450, from 494. The 265-line generator script and the 115-line design document are gone,
and the demo app is 206 lines you can actually edit. 83 tests pass throughout,
with `tsc` and prettier clean.

The lesson for the next pass: a line count is a hypothesis. Three of the nine
Could items were real code smells whose replacement would have been worse, and
one (`commandProblems`) rested on a claim about TypeScript that was simply
false. Checking cost minutes; not checking would have cost a diagnostic, a loud
error and a public API key.
