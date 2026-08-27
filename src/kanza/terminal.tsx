import {
  CSSProperties,
  Fragment,
  KeyboardEvent,
  ReactNode,
  SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import styles from './terminal.module.css'

export type TerminalClasses = {
  terminal?: string
  historyItem?: string
  historyRow?: string
  historyPrompt?: string
  historyInput?: string
  historyResponse?: string
  inputForm?: string
  prompt?: string
  cursor?: string
  helpContainer?: string
  helpExample?: string
  helpFlag?: string
  pending?: string
  welcome?: string
  scrollAnchor?: string
  screen?: string
}

// Every class name is the built in one plus yours, if you passed one for that
// part. Bound to `classes` once per component, so a site reads as cx('prompt').
const classNames =
  (classes?: TerminalClasses) => (key: keyof TerminalClasses) =>
    `${styles[key]} ${classes?.[key] ?? ''}`

export type CommandFlags = Record<string, string | boolean>

export type CommandFlagDefinition = {
  short?: string
  description?: string
}

export type CommandFlagDefinitions = Record<string, CommandFlagDefinition>

// Puts something else in the terminal for a while, instead of the history and the
// prompt. What you render there is yours, including the way out: `close` is handed
// to the handler, so you pass it into your own component however you like.
export type TerminalScreen = {
  open: (screen: ReactNode) => void
  close: () => void
}

export type CommandHandlerArgs = {
  rawInput: string
  input: string
  args: string[]
  flags: CommandFlags
  screen: TerminalScreen
}

export type CommandResponse = ReactNode | Promise<ReactNode> | void

export type CommandHandler = (args: CommandHandlerArgs) => CommandResponse

export type CommandHelp = {
  example: string
  description: string
}

export type CommandDefinition = {
  flags?: CommandFlagDefinitions
  help?: CommandHelp
  handle: CommandHandler
}

export type Commands = {
  [key: string]: CommandDefinition
} & {
  [key: `${string} ${string}`]: never
}

export type HistoryItem = {
  id: number
  rawInput: string
  response: ReactNode
  // The prompt as it was when the command ran, so changing the `prompt` prop
  // later does not rewrite the lines that are already there.
  prompt: string
  isClear?: boolean
  // An abandoned line, so it is shown but never recalled with the arrow keys.
  isInterrupt?: boolean
}

export type History = HistoryItem[]

const useScrollIntoView = (items: unknown[]) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (items.length) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [items])

  return ref
}

const useTerminalHistory = (prompt: string) => {
  const [history, setHistory] = useState<History>([])
  const nextId = useRef(0)

  const pushToHistory = (
    rawInput: string,
    response: CommandResponse,
    marks: Pick<HistoryItem, 'isClear' | 'isInterrupt'> = {},
  ) => {
    const id = nextId.current++

    setHistory((prev) => [
      ...prev,
      {
        id,
        rawInput,
        response: response as ReactNode,
        prompt,
        ...marks,
      },
    ])

    return id
  }

  const replaceResponse = (id: number, response: ReactNode) => {
    setHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, response } : item)),
    )
  }

  return { history, pushToHistory, replaceResponse }
}

// A token is a flag when it starts with one or two dashes followed by a letter.
// Requiring a letter keeps negative numbers, like the -5 in "sum -5 10", text.
// The dashes are captured because a declared command tells - and -- apart.
const DEFAULT_PROMPT = '>'

// The caret is the browser's own, so shape and blink are the browser's too. The
// two CSS properties that steer them are Chromium only for now: elsewhere you
// keep the default thin blinking bar, whatever these say.
export type CursorShape = 'bar' | 'block' | 'underscore'

export type TerminalCursor = {
  shape?: CursorShape
  blink?: boolean
}

const DEFAULT_CURSOR_SHAPE: CursorShape = 'bar'

const FLAG_TOKEN = /^(--?)([a-zA-Z].*)$/

type RawFlag = {
  dashes: string
  name: string
  value: string | boolean
}

// Splits a command line into its name, the words behind it, and its flags, without
// looking at any declaration yet. The command is only known after this runs.
//
// Without flags, everything behind the name is one string, also available as an
// array of words. With flags, a flag separates the words: every word after a
// flag belongs to that flag, until the next flag or the end of the line.
const parseCommandInput = (commandLine: string) => {
  const [commandName, ...tokens] = commandLine.split(/\s+/)

  const inputWords: string[] = []
  const rawFlags: RawFlag[] = []

  for (const token of tokens) {
    const flagToken = token.match(FLAG_TOKEN)

    if (flagToken) {
      const [, dashes, rest] = flagToken

      // "--name=John" carries its value. Only the first = counts, so
      // "--filter=a=b" keeps "a=b" as the value.
      const equals = rest.indexOf('=')
      const name = equals === -1 ? rest : rest.slice(0, equals)
      // No words may follow, so a flag on its own means true.
      const value = equals === -1 ? true : rest.slice(equals + 1)

      rawFlags.push({ dashes, name, value })
      continue
    }

    const openFlag = rawFlags.at(-1)

    if (!openFlag) {
      inputWords.push(token)
      continue
    }

    openFlag.value =
      openFlag.value === true || openFlag.value === ''
        ? token
        : `${openFlag.value} ${token}`
  }

  return {
    commandName,
    input: inputWords.join(' '),
    args: inputWords,
    rawFlags,
  }
}

// Works out which short form belongs to which flag. An explicit `short` wins, the
// rest take their first letter. Two flags wanting the same letter is a mistake in
// the command definition, so neither gets one and the command refuses to run.
const buildShortForms = (definitions: CommandFlagDefinitions) => {
  const longToShort: Record<string, string> = {}
  const taken = new Set<string>()

  // A conflict means no short form is safe to hand out, so both maps stay empty.
  const conflict = (message: string) => ({
    longToShort: {} as Record<string, string>,
    shortToLong: {} as Record<string, string>,
    conflict: `kanza: ${message}`,
  })

  for (const [long, definition] of Object.entries(definitions)) {
    if (!definition.short) continue

    if (taken.has(definition.short)) {
      const other = Object.keys(longToShort).find(
        (name) => longToShort[name] === definition.short,
      )

      return conflict(
        `--${other} and --${long} both use -${definition.short}. ` +
          'A short form belongs to one flag.',
      )
    }

    longToShort[long] = definition.short
    taken.add(definition.short)
  }

  const wantedBy: Record<string, string[]> = {}

  for (const [long, definition] of Object.entries(definitions)) {
    // An explicit short form already claimed this letter, on purpose.
    if (definition.short || taken.has(long[0])) continue
    wantedBy[long[0]] = [...(wantedBy[long[0]] ?? []), long]
  }

  for (const [letter, longs] of Object.entries(wantedBy)) {
    if (longs.length === 1) {
      longToShort[longs[0]] = letter
      continue
    }

    const names = longs.map((long) => `--${long}`)
    const listed =
      names.length === 2
        ? names.join(' and ')
        : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

    return conflict(
      `${listed} ${names.length === 2 ? 'both' : 'all'} want -${letter}. ` +
        'Neither gets a short form. Set `short` on one.',
    )
  }

  const shortToLong: Record<string, string> = {}
  for (const [long, short] of Object.entries(longToShort)) {
    shortToLong[short] = long
  }

  return { longToShort, shortToLong, conflict: undefined as string | undefined }
}

const unknownFlagError = (
  flag: RawFlag,
  definitions: CommandFlagDefinitions,
  longToShort: Record<string, string>,
) => {
  const typed = `${flag.dashes}${flag.name}`
  const longs = Object.keys(definitions)

  if (longs.length === 0) {
    return `Unknown flag: ${typed}\nThis command does not take flags.`
  }

  const available = longs
    .map((long) =>
      longToShort[long] ? `--${long} (-${longToShort[long]})` : `--${long}`,
    )
    .join(', ')

  return `Unknown flag: ${typed}\nAvailable flags: ${available}`
}

// Mistakes in a command definition that make it unreachable or unusable. These
// cannot wait until the command runs, because a name with a space in it never
// matches anything you type, so they go to the console as the Terminal renders.
const commandProblems = (commands: Commands) => {
  const problems: string[] = []

  for (const [name, definition] of Object.entries(commands)) {
    if (name === '') {
      problems.push('A command has an empty name.')
    } else if (/\s/.test(name)) {
      problems.push(`"${name}" has a space in it, so it can never be typed.`)
    } else if (FLAG_TOKEN.test(name)) {
      problems.push(`"${name}" starts with a dash, so it reads as a flag.`)
    }

    if (typeof definition?.handle !== 'function') {
      problems.push(`"${name}" has no handle function.`)
      continue
    }

    for (const [flag, { short }] of Object.entries(definition.flags ?? {})) {
      if (flag === '' || flag.startsWith('-') || /[\s=]/.test(flag)) {
        problems.push(`--${flag} on "${name}" can never be typed.`)
      }

      if (short !== undefined && !/^[a-zA-Z]$/.test(short)) {
        problems.push(
          `--${flag} has short form "${short}", which must be a single letter.`,
        )
      }
    }
  }

  return problems
}

type ResolvedFlags =
  { ok: true; flags: CommandFlags } | { ok: false; error: string }

// Turns the flags as typed into the flags the handler receives.
//
// Without a declaration anything goes and the dashes are decoration, which is the
// behaviour of a command that never said what it accepts. With a declaration only
// those flags exist, -- is for long names, - is for short ones, and the keys the
// handler sees are always the long names.
const resolveFlags = (
  rawFlags: RawFlag[],
  definitions?: CommandFlagDefinitions,
): ResolvedFlags => {
  const flags: CommandFlags = {}

  if (!definitions) {
    for (const { name, value } of rawFlags) flags[name] = value
    return { ok: true, flags }
  }

  const { longToShort, shortToLong, conflict } = buildShortForms(definitions)
  if (conflict) return { ok: false, error: conflict }

  for (const flag of rawFlags) {
    const long =
      flag.dashes === '--'
        ? flag.name in definitions
          ? flag.name
          : undefined
        : shortToLong[flag.name]

    if (!long) {
      return {
        ok: false,
        error: unknownFlagError(flag, definitions, longToShort),
      }
    }

    flags[long] = flag.value
  }

  return { ok: true, flags }
}

// Shown in place of the response while an async command is still running. The
// dots are animated in CSS, so nothing here needs a timer.
const Pending = ({ classes }: { classes?: TerminalClasses }) => {
  const cx = classNames(classes)

  return (
    <span className={cx('pending')}>
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  )
}

// The built ins are handled here rather than declared, so they exist only so that
// "help" can list them. A command of your own with the same name replaces them.
const BUILT_IN_HELP: Commands = {
  clear: {
    help: { example: 'clear', description: 'Clear the screen' },
    handle: () => {},
  },
  help: {
    help: { example: 'help [command]', description: 'Show this help' },
    handle: () => {},
  },
}

const isPromise = (value: CommandResponse): value is Promise<ReactNode> =>
  value != null && typeof (value as Promise<ReactNode>).then === 'function'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

interface HistoryListProps {
  history: History
  classes?: TerminalClasses
}

const HistoryList = ({ history, classes }: HistoryListProps) => {
  const cx = classNames(classes)

  return (
    <div role="log">
      {history.map((h) => (
        <div key={h.id} className={cx('historyItem')}>
          <div className={cx('historyRow')}>
            <span className={cx('historyPrompt')}>{h.prompt}</span>
            <span className={cx('historyInput')}>{h.rawInput}</span>
          </div>
          {h.response && (
            <div className={cx('historyResponse')}>{h.response}</div>
          )}
        </div>
      ))}
    </div>
  )
}

interface HelpProps {
  commands: Record<string, CommandDefinition>
  heading?: string
  classes?: TerminalClasses
}

// Lists a flag as "--name, -n", or as "--name" when it has no short form.
const flagNames = (long: string, short?: string) =>
  short ? `--${long}, -${short}` : `--${long}`

const Help = ({
  commands,
  heading = 'Available commands:',
  classes,
}: HelpProps) => {
  const cx = classNames(classes)

  return (
    <div className={cx('helpContainer')}>
      {heading}
      {Object.entries(commands)
        .filter(([_, cmd]) => cmd.help)
        .map(([name, cmd], index) => {
          const { longToShort } = buildShortForms(cmd.flags ?? {})

          return (
            <Fragment key={name}>
              {(heading || index > 0) && <br />}
              <span className={cx('helpExample')}>
                {cmd.help?.example}
              </span> - {cmd.help?.description}
              {Object.entries(cmd.flags ?? {}).map(([long, definition]) => (
                <Fragment key={long}>
                  <br />
                  <span className={cx('helpFlag')}>
                    {flagNames(long, longToShort[long])}
                  </span>{' '}
                  {definition.description}
                </Fragment>
              ))}
            </Fragment>
          )
        })}
    </div>
  )
}

interface CommandInputProps {
  onSubmitCommand: (command: string) => boolean
  onCancel: (typed: string) => boolean
  history: History
  prompt: string
  classes?: TerminalClasses
}

const CommandInput = ({
  onSubmitCommand,
  onCancel,
  history,
  prompt,
  classes,
}: CommandInputProps) => {
  const cx = classNames(classes)
  const commandInputRef = useRef<HTMLInputElement>(null)
  const [historyPointer, setHistoryPointer] = useState(-1)
  // What was typed before the first Up, so the recall stays filtered on it while
  // you keep walking. Like zsh's history-beginning-search and fish.
  const [searchPrefix, setSearchPrefix] = useState('')

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget

    if (e.ctrlKey && e.key === 'c') {
      // In a browser Ctrl+C is copy, so only interrupt when nothing is selected.
      if (!window.getSelection()?.isCollapsed) return

      e.preventDefault()

      // Ctrl+C goes to the running command first, and leaves the prompt alone,
      // because what is typed there was typed while waiting for that command.
      if (onCancel(input.value)) return

      // Nothing was running, so it abandons the line instead, like an idle shell.
      input.value = ''
      setHistoryPointer(-1)
      return
    }

    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return

    // A fresh walk starts from whatever is on the line right now.
    const prefix = historyPointer === -1 ? input.value : searchPrefix

    const recallable = history.filter(
      (item) => !item.isInterrupt && item.rawInput.startsWith(prefix),
    )
    if (recallable.length === 0) return

    e.preventDefault()
    setSearchPrefix(prefix)

    // Up walks back through the matches, down walks forward again, and -1 is the
    // line you started on. Writing `value` puts the caret at the end.
    const step = e.key === 'ArrowUp' ? 1 : -1
    const next = Math.min(
      Math.max(historyPointer + step, -1),
      recallable.length - 1,
    )

    setHistoryPointer(next)
    input.value =
      next === -1 ? prefix : (recallable.at(-1 - next)?.rawInput ?? '')
  }

  const handleFormSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = commandInputRef.current
    if (!input) return

    // Refused because a command is still running, so leave the line alone.
    if (!onSubmitCommand(input.value)) return

    input.value = ''
    setHistoryPointer(-1)
  }

  return (
    <form onSubmit={handleFormSubmit} className={cx('inputForm')}>
      <span className={cx('prompt')}>{prompt}</span>
      <input
        autoFocus
        aria-label="command"
        ref={commandInputRef}
        className={cx('cursor')}
        onKeyDown={handleKeyDown}
        // Typing anything ends the current walk, so the next Up filters again.
        onChange={() => setHistoryPointer(-1)}
        autoComplete="off"
        spellCheck="false"
      />
    </form>
  )
}

type RunningCommand = {
  id: number
  cancelled: boolean
}

type CommandOutcome = {
  response: CommandResponse
  isClear?: boolean
}

export type TerminalProps = {
  commands: Commands
  prompt?: string
  welcome?: string
  cursor?: TerminalCursor
  classes?: TerminalClasses
}

export const Terminal = ({
  commands,
  prompt = DEFAULT_PROMPT,
  welcome,
  cursor = {},
  classes,
}: TerminalProps) => {
  const cx = classNames(classes)

  const { shape = DEFAULT_CURSOR_SHAPE, blink = true } = cursor

  // Set on the terminal box, not on the input: custom properties inherit, so
  // .cursor picks them up without threading two more props down. The cast is
  // needed because CSSProperties has no index signature for custom properties.
  const cursorVars = {
    '--kanza-caret-shape': shape,
    '--kanza-caret-animation': blink ? 'auto' : 'manual',
  } as CSSProperties

  const { history, pushToHistory, replaceResponse } = useTerminalHistory(prompt)

  // What the terminal shows instead of itself. The history stays where it is while
  // this is set, so closing brings it back untouched. One screen at a time: opening
  // another one replaces it, and closing always lands back at the prompt.
  const [screen, setScreen] = useState<ReactNode>(null)

  const screenApi: TerminalScreen = {
    // Through the updater, so a node that happens to be a function is not
    // mistaken for one.
    open: (next) => setScreen(() => next),
    close: () => setScreen(null),
  }

  const { visibleHistory, hasCleared } = useMemo(() => {
    const lastClearIndex = history.findLastIndex((item) => item.isClear)

    return {
      visibleHistory: history.slice(lastClearIndex + 1),
      hasCleared: lastClearIndex !== -1,
    }
  }, [history])

  const bottomRef = useScrollIntoView(visibleHistory)

  useEffect(() => {
    for (const problem of commandProblems(commands)) {
      console.error(`kanza: ${problem}`)
    }
  }, [commands])

  // The command that is still running. Not rendered, so a ref is enough.
  const runningRef = useRef<RunningCommand | null>(null)

  // Works out what a line should put in the history, without running anything else.
  const responseFor = (trimmed: string): CommandOutcome => {
    const { commandName, input, args, rawFlags } = parseCommandInput(trimmed)
    const cmdDef = commands[commandName]

    if (cmdDef) {
      const resolved = resolveFlags(rawFlags, cmdDef.flags)

      if (!resolved.ok) return { response: resolved.error }

      try {
        return {
          response: cmdDef.handle({
            rawInput: trimmed,
            input,
            args,
            flags: resolved.flags,
            screen: screenApi,
          }),
        }
      } catch (error) {
        // A handler that throws fails the same way as one whose promise rejects.
        return { response: `Error: ${errorMessage(error)}` }
      }
    }

    if (commandName === 'clear') return { response: null, isClear: true }

    if (commandName === 'help') {
      const virtualCommands: Commands = { ...BUILT_IN_HELP, ...commands }

      if (!input) {
        return {
          response: <Help commands={virtualCommands} classes={classes} />,
        }
      }

      const wanted = virtualCommands[input]

      if (!wanted) return { response: `Unknown command: ${input}` }
      if (!wanted.help) return { response: `No help for "${input}"` }

      return {
        response: (
          <Help commands={{ [input]: wanted }} heading="" classes={classes} />
        ),
      }
    }

    return { response: `Unknown command: ${trimmed}` }
  }

  const finish = (running: RunningCommand, response: ReactNode) => {
    // Ctrl+C already dealt with this line, so its late result is not wanted.
    if (running.cancelled) return

    runningRef.current = null
    replaceResponse(running.id, response)
  }

  // Returns whether the line was accepted. While a command runs it is not, and
  // the prompt keeps what was typed so you can see it did not run yet.
  const handleCommand = (commandText: string) => {
    if (runningRef.current) return false

    const trimmed = commandText.trim()
    if (!trimmed) return true

    const { response, isClear } = responseFor(trimmed)

    if (isPromise(response)) {
      const running: RunningCommand = {
        id: pushToHistory(trimmed, <Pending classes={classes} />),
        cancelled: false,
      }
      runningRef.current = running

      response.then(
        (settled) => finish(running, settled),
        (error) => finish(running, `Error: ${errorMessage(error)}`),
      )
      return true
    }

    pushToHistory(trimmed, response, { isClear })
    return true
  }

  // Ctrl+C: give up on the running command. Returns whether there was one.
  const handleCancel = (typed: string) => {
    const running = runningRef.current

    if (running) {
      running.cancelled = true
      runningRef.current = null
      replaceResponse(running.id, 'Cancelled')
      return true
    }

    // Nothing was running, so the abandoned line is what gets a trace. A shell
    // does not remember it either, hence isInterrupt.
    pushToHistory(`${typed}^C`, null, { isInterrupt: true })
    return false
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        // A screen looks after its own focus, and any input in there is not ours.
        if (screen) return
        e.currentTarget.querySelector('input')?.focus()
      }}
      className={cx('terminal')}
      style={cursorVars}
    >
      {screen ? (
        <div className={cx('screen')}>{screen}</div>
      ) : (
        <>
          {welcome && !hasCleared && (
            <div className={cx('welcome')}>{welcome}</div>
          )}
          <HistoryList history={visibleHistory} classes={classes} />
          <CommandInput
            onSubmitCommand={handleCommand}
            onCancel={handleCancel}
            history={history}
            prompt={prompt}
            classes={classes}
          />
          <div ref={bottomRef} className={cx('scrollAnchor')} />
        </>
      )}
    </div>
  )
}
