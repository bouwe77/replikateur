# Design: tab completion

Status: not built. This is the UX map, made before any implementation, so the
scope can be decided first. Nothing here is in the code yet.

## Context

`Tab` is the one staple every real terminal has that Kanza is missing. The
material is already there: command names are the keys of the `commands` prop,
flag names are the keys of a command's `flags`, and `CommandInput` already
handles keys of its own (`ArrowUp`, `ArrowDown`, `Ctrl+C`).

What is *not* obvious is how much surface `Tab` has. It touches command names,
flags, values, the built-in `help`, screens, and the browser's own focus
handling. This document lists every case, so the cheap parts can ship without
dragging the expensive part along.

## The unavoidable part

In a browser, `Tab` moves focus to the next element. So Kanza must call
`preventDefault` on `Tab` **always**, including when there is nothing to
complete. Otherwise focus leaves the input and the terminal is dead until you
click it again.

This is not a feature choice. It is the price of using the key at all.

## Case 1: the first word (command name)

| You typed   | Commands available | What could happen                              |
| ----------- | ------------------ | ---------------------------------------------- |
| `` (empty)  | any                | list everything, or do nothing                 |
| `he`        | only `hello`       | becomes `hello ` (with a trailing space)       |
| `h`         | `hello`, `help`    | shared prefix is `h`, already typed → list or cycle |
| `de`        | `deploy`, `destroy`| `dep` and `des` differ, so nothing grows       |
| `xyz`       | no match           | nothing. A real shell beeps; Kanza has no beep |
| `hello`     | `hello` exists     | add a trailing space, so args can follow       |

The real decision here is **list versus cycle**.

- **List** (bash): print the candidates, leave the typed line alone. Bash needs
  two `Tab` presses for this, but that double press only makes sense when the
  first press beeps. Without a beep, listing on the first press is better.
- **Cycle** (zsh, fish): every `Tab` puts the next candidate on the line. Nice
  with a handful of commands, annoying with twenty.

Listing has a wrinkle that is specific to Kanza. The prompt is a permanent line
at the bottom, so "printing" the candidates means pushing a history item. That
item must not be recallable with `ArrowUp`. The `^C` line already works exactly
like that (`isInterrupt`), so the mechanism exists.

## Case 2: flags

Only meaningful for a command that declares `flags`. `add --na` becomes
`add --name `. The same list-or-cycle question applies when several match.

Smaller questions inside this case:

- `add --` followed by `Tab`: list all flags of `add`? Probably yes, that is the
  useful move.
- Do short forms complete? `add -n` is already complete, there is nothing to
  grow. So no.
- Hide `--name` from the list once `--name John` is on the line? Nice, but it
  means tracking what is already used. Not worth it.
- A command that declares no flags accepts any flag, so there is nothing to
  suggest. `Tab` does nothing.

## Case 3: values, and the wall

`add --city <Tab>`, `go <Tab>`, `deploy <Tab>`: the library has no idea what the
valid values are. Only the command knows. So either this is skipped completely,
or Kanza needs an API for it, for example a `complete` function per flag or per
command that returns candidates.

That is a real feature with a real API to design, not a small addition. It is
also the one part that is expensive to change later, because it becomes public
API.

One exception is awkward, because it is built in: `help <Tab>` should complete
command names, and `help` belongs to Kanza. So either `help` gets special-cased,
or the completion API gets built and Kanza uses it for its own command.

## Case 4: cases that need no work

- **Nested REPL.** Completion reads the current `commands` prop, so inside
  `oompa` you get oompa's commands for free.
- **Screens.** No input is rendered and Kanza listens for nothing, so `Tab`
  belongs to whatever the screen renders. Worth one line in the readme: your
  screen receives raw `Tab`, browser focus behaviour included.
- **After `ArrowUp`.** History recall leaves a normal line of text behind, and
  `Tab` treats it like anything else typed.

## Case 5: behaviour details to decide

- **Cursor in the middle of the line.** Complete the word under the cursor, or
  only act when the cursor is at the end? End-only is much simpler and covers
  nearly all real use.
- **While a command is running.** `Enter` is blocked, but typing is allowed.
  `Tab` is editing, not running, so allowing it fits. Decide it on purpose
  either way.
- **Case sensitivity.** Command names are matched exactly today. Completion
  should match exactly too, otherwise `HE` completes to `hello` and produces a
  line that does not run.
- **Trailing space.** The space after a completed word is the signal that the
  word is finished. Worth having.
- **History pointer.** `Tab` changes the line, so it probably resets
  `historyPointer` the same way typing conceptually does. Minor, but it is a
  choice.

## Recommended scope

1. **Build:** case 1 only. List instead of cycle, end-of-line only,
   `preventDefault` always. This is the staple, and it is small.
2. **Then judge:** case 2 (flags), based on using case 1 for a while.
3. **Leave out:** case 3, until a command actually needs it. That is where the
   API design cost sits, and it is the only part that is hard to undo.
