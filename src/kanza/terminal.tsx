import {
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
}

export type CommandFlags = Record<string, string | boolean>

export type CommandFlagDefinition = {
  short?: string
  description?: string
}

export type CommandFlagDefinitions = Record<string, CommandFlagDefinition>

export type CommandHandlerArgs = {
  rawInput: string
  input: string
  args: string[]
  flags: CommandFlags
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

const useIdCounter = () => {
  const counter = useRef(0)
  return () => counter.current++
}

const useFocus = <T extends HTMLElement>() => {
  const ref = useRef<T>(null)
  const setFocus = () => {
    ref.current?.focus()
  }
  useEffect(() => {
    setFocus()
  }, [])
  return { ref, setFocus }
}

const useScrollIntoView = (dependency: any) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hasContent = Array.isArray(dependency)
      ? dependency.length > 0
      : !!dependency

    if (hasContent) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [dependency])

  return ref
}

const useTerminalHistory = (prompt: string) => {
  const [history, setHistory] = useState<History>([])
  const getNextId = useIdCounter()

  const pushToHistory = (
    rawInput: string,
    response: CommandResponse,
    marks: Pick<HistoryItem, 'isClear' | 'isInterrupt'> = {},
  ) => {
    const id = getNextId()

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

const FLAG_TOKEN = /^(--?)([a-zA-Z].*)$/

type RawFlag = {
  dashes: number
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

      rawFlags.push({ dashes: dashes.length, name, value })
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

  for (const [long, definition] of Object.entries(definitions)) {
    if (!definition.short) continue

    if (taken.has(definition.short)) {
      const other = Object.keys(longToShort).find(
        (name) => longToShort[name] === definition.short,
      )

      return {
        longToShort: {},
        shortToLong: {},
        conflict:
          `kanza: --${other} and --${long} both use -${definition.short}. ` +
          'A short form belongs to one flag.',
      }
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

    return {
      longToShort: {},
      shortToLong: {},
      conflict:
        `kanza: ${listed} ${names.length === 2 ? 'both' : 'all'} want -${letter}. ` +
        'Neither gets a short form. Set `short` on one.',
    }
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
  const typed = `${'-'.repeat(flag.dashes)}${flag.name}`
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
      flag.dashes === 2
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
const Pending = ({ classes }: { classes?: TerminalClasses }) => (
  <span className={`${styles.pending} ${classes?.pending || ''}`}>
    <span>.</span>
    <span>.</span>
    <span>.</span>
  </span>
)

const isPromise = (value: CommandResponse): value is Promise<ReactNode> =>
  value != null && typeof (value as Promise<ReactNode>).then === 'function'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

interface HistoryListProps {
  history: History
  classes?: TerminalClasses
}

export const HistoryList = ({ history, classes }: HistoryListProps) => {
  return (
    <div role="log">
      {history.map((h) => (
        <div
          key={h.id}
          className={`${styles.historyItem} ${classes?.historyItem || ''}`}
        >
          <div className={`${styles.historyRow} ${classes?.historyRow || ''}`}>
            <span
              className={`${styles.historyPrompt} ${
                classes?.historyPrompt || ''
              }`}
            >
              {h.prompt}
            </span>
            <span
              className={`${styles.historyInput} ${
                classes?.historyInput || ''
              }`}
            >
              {h.rawInput}
            </span>
          </div>
          {h.response && (
            <div
              className={`${styles.historyResponse} ${
                classes?.historyResponse || ''
              }`}
            >
              {h.response}
            </div>
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

export const Help = ({
  commands,
  heading = 'Available commands:',
  classes,
}: HelpProps) => (
  <div className={`${styles.helpContainer} ${classes?.helpContainer || ''}`}>
    {heading}
    {Object.entries(commands)
      .filter(([_, cmd]) => cmd.help)
      .map(([name, cmd], index) => {
        const { longToShort } = buildShortForms(cmd.flags ?? {})

        return (
          <Fragment key={name}>
            {(heading || index > 0) && <br />}
            <span
              className={`${styles.helpExample} ${classes?.helpExample || ''}`}
            >
              {cmd.help?.example}
            </span>{' '}
            - {cmd.help?.description}
            {Object.entries(cmd.flags ?? {}).map(([long, definition]) => (
              <Fragment key={long}>
                <br />
                <span
                  className={`${styles.helpFlag} ${classes?.helpFlag || ''}`}
                >
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

interface CommandInputProps {
  onSubmitCommand: (command: string) => boolean
  onCancel: (typed: string) => boolean
  history: History
  prompt: string
  classes?: TerminalClasses
}

export const CommandInput = ({
  onSubmitCommand,
  onCancel,
  history,
  prompt,
  classes,
}: CommandInputProps) => {
  const { ref: commandInputRef, setFocus } = useFocus<HTMLInputElement>()
  const [historyPointer, setHistoryPointer] = useState(-1)

  const moveCursorToEnd = () => {
    setTimeout(() => {
      if (commandInputRef.current) {
        const length = commandInputRef.current.value.length
        commandInputRef.current.setSelectionRange(length, length)
      }
    }, 0)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && e.key === 'c') {
      // In a browser Ctrl+C is copy, so only interrupt when nothing is selected.
      if (!window.getSelection()?.isCollapsed) return

      e.preventDefault()

      // Ctrl+C goes to the running command first, and leaves the prompt alone,
      // because what is typed there was typed while waiting for that command.
      if (onCancel(commandInputRef.current?.value ?? '')) return

      // Nothing was running, so it abandons the line instead, like an idle shell.
      if (commandInputRef.current) commandInputRef.current.value = ''
      setHistoryPointer(-1)
      return
    }

    const recallable = history.filter((item) => !item.isInterrupt)
    if (recallable.length === 0) return

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIndex = Math.min(historyPointer + 1, recallable.length - 1)
      setHistoryPointer(nextIndex)

      const historicalCmd = recallable[recallable.length - 1 - nextIndex]
      if (historicalCmd && commandInputRef.current) {
        commandInputRef.current.value = historicalCmd.rawInput
        moveCursorToEnd()
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = historyPointer - 1
      setHistoryPointer(nextIndex)

      if (nextIndex <= -1) {
        setHistoryPointer(-1)
        if (commandInputRef.current) commandInputRef.current.value = ''
      } else {
        const historicalCmd = recallable[recallable.length - 1 - nextIndex]
        if (historicalCmd && commandInputRef.current) {
          commandInputRef.current.value = historicalCmd.rawInput
          moveCursorToEnd()
        }
      }
    }
  }

  const handleFormSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!commandInputRef.current) return

    // Refused because a command is still running, so leave the line alone.
    if (!onSubmitCommand(commandInputRef.current.value)) return

    commandInputRef.current.value = ''
    setHistoryPointer(-1)
    setFocus()
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className={`${styles.inputForm} ${classes?.inputForm || ''}`}
    >
      <span className={`${styles.prompt} ${classes?.prompt || ''}`}>
        {prompt}
      </span>
      <input
        aria-label="command"
        ref={commandInputRef}
        className={`${styles.cursor} ${classes?.cursor || ''}`}
        onKeyDown={handleKeyDown}
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
  classes?: TerminalClasses
}

export const Terminal = ({
  commands,
  prompt = DEFAULT_PROMPT,
  welcome,
  classes,
}: TerminalProps) => {
  const { history, pushToHistory, replaceResponse } = useTerminalHistory(prompt)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const { visibleHistory, hasCleared } = useMemo(() => {
    let lastClearIndex = -1
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].isClear) {
        lastClearIndex = i
        break
      }
    }

    return {
      visibleHistory:
        lastClearIndex === -1 ? history : history.slice(lastClearIndex + 1),
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
          }),
        }
      } catch (error) {
        // A handler that throws fails the same way as one whose promise rejects.
        return { response: `Error: ${errorMessage(error)}` }
      }
    }

    if (commandName === 'clear') return { response: null, isClear: true }

    if (commandName === 'help') {
      const virtualCommands: Commands = {
        clear: {
          help: { example: 'clear', description: 'Clear the screen' },
          handle: () => {},
        },
        help: {
          help: { example: 'help [command]', description: 'Show this help' },
          handle: () => {},
        },
        ...commands,
      }

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
      ref={containerRef}
      role="presentation"
      onClick={() => containerRef.current?.querySelector('input')?.focus()}
      className={`${styles.terminal} ${classes?.terminal || ''}`}
    >
      {welcome && !hasCleared && (
        <div className={`${styles.welcome} ${classes?.welcome || ''}`}>
          {welcome}
        </div>
      )}
      <HistoryList history={visibleHistory} classes={classes} />
      <CommandInput
        onSubmitCommand={handleCommand}
        onCancel={handleCancel}
        history={history}
        prompt={prompt}
        classes={classes}
      />
      <div
        ref={bottomRef}
        className={`${styles.scrollAnchor} ${classes?.scrollAnchor || ''}`}
      />
    </div>
  )
}
