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
import styles from './index.module.css'

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
  scrollAnchor?: string
}

export type CommandHandlerArgs = {
  rawInput: string
  args: string[]
}

export type CommandResponse = ReactNode | void

export type CommandHandler = (args: CommandHandlerArgs) => CommandResponse

export type CommandHelp = {
  example: string
  description: string
}

export type CommandDefinition = {
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
  isClear?: boolean
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

const useTerminalHistory = () => {
  const [history, setHistory] = useState<History>([])
  const getNextId = useIdCounter()

  const pushToHistory = (
    rawInput: string,
    response: CommandResponse,
    isClear = false,
  ) => {
    setHistory((prev) => [
      ...prev,
      {
        id: getNextId(),
        rawInput,
        response: response as ReactNode,
        isClear,
      },
    ])
  }

  return { history, pushToHistory }
}

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
              &gt;
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
  commands: Commands
  classes?: TerminalClasses
}

export const Help = ({ commands, classes }: HelpProps) => (
  <div className={`${styles.helpContainer} ${classes?.helpContainer || ''}`}>
    Available commands:
    {Object.entries(commands)
      .filter(([_, cmd]) => cmd.help)
      .map(([name, cmd]) => (
        <Fragment key={name}>
          <br />
          <span
            className={`${styles.helpExample} ${classes?.helpExample || ''}`}
          >
            {cmd.help?.example}
          </span>{' '}
          - {cmd.help?.description}
        </Fragment>
      ))}
  </div>
)

interface CommandInputProps {
  onSubmitCommand: (command: string) => void
  history: History
  classes?: TerminalClasses
}

export const CommandInput = ({
  onSubmitCommand,
  history,
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
    if (history.length === 0) return

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIndex = Math.min(historyPointer + 1, history.length - 1)
      setHistoryPointer(nextIndex)

      const historicalCmd = history[history.length - 1 - nextIndex]
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
        const historicalCmd = history[history.length - 1 - nextIndex]
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
    onSubmitCommand(commandInputRef.current.value)
    commandInputRef.current.value = ''
    setHistoryPointer(-1)
    setFocus()
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className={`${styles.inputForm} ${classes?.inputForm || ''}`}
    >
      <span className={`${styles.prompt} ${classes?.prompt || ''}`}>&gt;</span>
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

interface TerminalProps {
  commands: Commands
  classes?: TerminalClasses
}

export const Terminal = ({ commands, classes }: TerminalProps) => {
  const { history, pushToHistory } = useTerminalHistory()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const visibleHistory = useMemo(() => {
    let lastClearIndex = -1
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].isClear) {
        lastClearIndex = i
        break
      }
    }
    return lastClearIndex === -1 ? history : history.slice(lastClearIndex + 1)
  }, [history])

  const bottomRef = useScrollIntoView(visibleHistory)

  const handleCommand = (commandText: string) => {
    const trimmed = commandText.trim()
    if (!trimmed) return

    const parts = trimmed.split(' ').filter((x) => x !== '')
    const commandName = parts[0]
    const args = parts.slice(1)

    if (commands[commandName]) {
      const cmdDef = commands[commandName]
      const response = cmdDef.handle({ rawInput: trimmed, args })
      pushToHistory(trimmed, response)
      return
    }

    if (commandName === 'clear') {
      pushToHistory(trimmed, null, true)
      return
    }

    if (commandName === 'help') {
      const virtualCommands: Commands = {
        clear: {
          help: { example: 'clear', description: 'Clear terminal history' },
          handle: () => {},
        },
        help: {
          help: { example: 'help', description: 'Show this help' },
          handle: () => {},
        },
        ...commands,
      }
      pushToHistory(
        trimmed,
        <Help commands={virtualCommands} classes={classes} />,
      )
      return
    }

    pushToHistory(trimmed, `Unknown command: ${trimmed}`)
  }

  return (
    <div
      ref={containerRef}
      role="presentation"
      onClick={() => containerRef.current?.querySelector('input')?.focus()}
      className={`${styles.terminal} ${classes?.terminal || ''}`}
    >
      <HistoryList history={visibleHistory} classes={classes} />
      <CommandInput
        onSubmitCommand={handleCommand}
        history={history}
        classes={classes}
      />
      <div
        ref={bottomRef}
        className={`${styles.scrollAnchor} ${classes?.scrollAnchor || ''}`}
      />
    </div>
  )
}
