import { useState } from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CommandHandlerArgs, Commands, Terminal } from './terminal'

// Mock scrollIntoView since it doesn't exist in JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn()

describe('Terminal Component', () => {
  const mockCommands: Commands = {
    hello: {
      handle: () => 'Hello World!',
      help: { example: 'hello', description: 'Says hello' },
    },
    sum: {
      handle: ({ args }) => {
        const total = args.reduce((acc, curr) => acc + parseInt(curr), 0)
        return `Sum: ${total}`
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- 1. Rendering & Basic Input ---

  test('renders terminal structure correctly', () => {
    render(<Terminal commands={mockCommands} />)

    // Check for the command prompt character
    expect(screen.getByText('>')).toBeInTheDocument()

    // Check for the input field by its accessible name
    const input = screen.getByRole('textbox', { name: /command/i })
    expect(input).toBeInTheDocument()
  })

  test('ignores empty input', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)

    const input = screen.getByRole('textbox', { name: /command/i })

    await user.type(input, '   {enter}')

    // The history log should be empty
    const log = screen.queryByRole('log')
    expect(log).toBeEmptyDOMElement()
  })

  // --- 2. User Command Execution ---

  test('executes valid user command', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)

    const input = screen.getByRole('textbox', { name: /command/i })

    await user.type(input, 'hello{enter}')

    const log = screen.getByRole('log')
    // Check for command echo
    expect(within(log).getByText('hello')).toBeInTheDocument()
    // Check for command response
    expect(within(log).getByText('Hello World!')).toBeInTheDocument()
  })

  test('handles arguments', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)

    const input = screen.getByRole('textbox', { name: /command/i })

    await user.type(input, 'sum 10 20 5{enter}')

    const log = screen.getByRole('log')
    expect(within(log).getByText('Sum: 35')).toBeInTheDocument()
  })

  test('handles unknown commands', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)

    const input = screen.getByRole('textbox', { name: /command/i })

    await user.type(input, 'foo{enter}')

    const log = screen.getByRole('log')
    expect(within(log).getByText('Unknown command: foo')).toBeInTheDocument()
  })

  // --- 3. System Commands ---

  test('executes system "help"', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)

    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, 'help{enter}')

    const log = screen.getByRole('log')

    // Should show system commands
    expect(within(log).getByText('clear')).toBeInTheDocument()
    // Should show user commands
    expect(within(log).getByText('hello')).toBeInTheDocument()
  })

  test('executes system "clear"', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)

    const input = screen.getByRole('textbox', { name: /command/i })

    // Add some clutter
    await user.type(input, 'hello{enter}')
    expect(screen.getByText('Hello World!')).toBeInTheDocument()

    // Clear it
    await user.type(input, 'clear{enter}')

    // The log should be empty (or at least not contain the old text)
    expect(screen.queryByText('Hello World!')).not.toBeInTheDocument()
  })

  test('"clear" preserves navigation history', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)
    const input = screen.getByRole('textbox', { name: /command/i })

    // Type a command
    await user.type(input, 'hello{enter}')

    // Clear the screen
    await user.type(input, 'clear{enter}')

    // Press Up twice: once for 'clear', once for 'hello'
    await user.type(input, '{arrowup}')
    expect(input).toHaveValue('clear')

    await user.type(input, '{arrowup}')
    expect(input).toHaveValue('hello')
  })

  test('user commands override system commands', async () => {
    const user = userEvent.setup()
    const overrideCommands = {
      clear: {
        handle: () => 'I will not clear!',
      },
    }
    render(<Terminal commands={overrideCommands} />)

    const input = screen.getByRole('textbox', { name: /command/i })

    await user.type(input, 'clear{enter}')

    // Should see the user's message, not a cleared screen
    expect(screen.getByText('I will not clear!')).toBeInTheDocument()
  })

  // --- 4. History Navigation ---

  test('navigates history with ArrowUp and ArrowDown', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)
    const input = screen.getByRole('textbox', { name: /command/i })

    await user.type(input, 'first{enter}')
    await user.type(input, 'second{enter}')
    await user.type(input, 'third{enter}')

    // Go back
    await user.type(input, '{arrowup}')
    expect(input).toHaveValue('third')

    await user.type(input, '{arrowup}')
    expect(input).toHaveValue('second')

    await user.type(input, '{arrowup}')
    expect(input).toHaveValue('first')

    // Go forward
    await user.type(input, '{arrowdown}')
    expect(input).toHaveValue('second')

    await user.type(input, '{arrowdown}')
    expect(input).toHaveValue('third')

    // Back to empty
    await user.type(input, '{arrowdown}')
    expect(input).toHaveValue('')
  })

  test('filters history by what is already typed', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)
    const input = screen.getByRole('textbox', { name: /command/i })

    await user.type(input, 'help{enter}')
    await user.type(input, 'clear{enter}')
    await user.type(input, 'hello{enter}')

    await user.type(input, 'he')
    await user.type(input, '{arrowup}')
    expect(input).toHaveValue('hello')

    await user.type(input, '{arrowup}')
    expect(input).toHaveValue('help')

    // No older match, so it stays put.
    await user.type(input, '{arrowup}')
    expect(input).toHaveValue('help')

    // Walking forward past the newest match restores what was typed.
    await user.type(input, '{arrowdown}')
    expect(input).toHaveValue('hello')

    await user.type(input, '{arrowdown}')
    expect(input).toHaveValue('he')

    // Typing again starts a new search with the new prefix.
    await user.clear(input)
    await user.type(input, 'c{arrowup}')
    expect(input).toHaveValue('clear')
  })

  test('places cursor at end of text on history recall', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)
    const input = screen.getByRole('textbox', {
      name: /command/i,
    }) as HTMLInputElement

    await user.type(input, 'abc{enter}')

    // Wait for the keyup/state update cycle
    await user.type(input, '{arrowup}')

    // We need to wait for the setTimeout(0) in the component
    await new Promise((r) => setTimeout(r, 10))

    expect(input.selectionStart).toBe(3)
    expect(input.selectionEnd).toBe(3)
  })

  // --- 5. Focus & Scroll Behavior ---

  test('auto-focuses input on mount', () => {
    render(<Terminal commands={mockCommands} />)
    const input = screen.getByRole('textbox', { name: /command/i })
    expect(input).toHaveFocus()
  })

  test('focuses input when clicking container', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)
    const input = screen.getByRole('textbox', { name: /command/i })
    const container = screen.getByRole('presentation')

    // Blur first
    input.blur()
    expect(input).not.toHaveFocus()

    // Click anywhere in black area
    await user.click(container)
    expect(input).toHaveFocus()
  })

  test('auto-scrolls when output is added', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={mockCommands} />)
    const input = screen.getByRole('textbox', { name: /command/i })

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(0)

    await user.type(input, 'hello{enter}')

    // Should scroll after adding to history
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })
})

describe('Command arguments and flags', () => {
  const received = vi.fn()

  const argCommands: Commands = {
    dump: {
      handle: (handlerArgs) => {
        received(handlerArgs)
        return 'ok'
      },
    },
  }

  // Types a command line and returns what the handler received.
  const run = async (commandLine: string) => {
    const user = userEvent.setup()
    render(<Terminal commands={argCommands} />)

    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, `${commandLine}{enter}`)

    return received.mock.lastCall?.[0] as CommandHandlerArgs
  }

  beforeEach(() => {
    received.mockClear()
  })

  test('passes everything behind the command as a string and as words', async () => {
    const { input, args, flags } = await run('dump north east')

    expect(input).toBe('north east')
    expect(args).toEqual(['north', 'east'])
    expect(flags).toEqual({})
  })

  test('keeps the command name in rawInput only', async () => {
    const { rawInput, input } = await run('dump north east')

    expect(rawInput).toBe('dump north east')
    expect(input).toBe('north east')
  })

  test('collapses runs of whitespace in input', async () => {
    const { input, args } = await run('dump   north    east')

    expect(input).toBe('north east')
    expect(args).toEqual(['north', 'east'])
  })

  test('reads a long flag without a value as true', async () => {
    const { input, flags } = await run('dump --force')

    expect(flags).toEqual({ force: true })
    expect(input).toBe('')
  })

  test('reads a short flag without a value as true', async () => {
    const { flags } = await run('dump -f')

    expect(flags).toEqual({ f: true })
  })

  test('reads the words after a flag as its value', async () => {
    const { flags } = await run('dump --name John Doe')

    expect(flags).toEqual({ name: 'John Doe' })
  })

  test('uses a flag as the separator between values', async () => {
    const { input, args, flags } = await run(
      'dump --name John Doe --city New York',
    )

    expect(flags).toEqual({ name: 'John Doe', city: 'New York' })
    expect(input).toBe('')
    expect(args).toEqual([])
  })

  test('combines text before the first flag with flags', async () => {
    const { input, args, flags } = await run('dump staging --force')

    expect(input).toBe('staging')
    expect(args).toEqual(['staging'])
    expect(flags).toEqual({ force: true })
  })

  test('does not read a negative number as a flag', async () => {
    const { input, args, flags } = await run('dump -5 10')

    expect(input).toBe('-5 10')
    expect(args).toEqual(['-5', '10'])
    expect(flags).toEqual({})
  })

  test('keeps the last value when a flag is repeated', async () => {
    const { flags } = await run('dump --name John --name Jane')

    expect(flags).toEqual({ name: 'Jane' })
  })
})

describe('Declared flags', () => {
  const received = vi.fn()

  const declaredCommands: Commands = {
    add: {
      flags: {
        name: { description: 'The name' },
        city: {},
      },
      handle: (handlerArgs) => {
        received(handlerArgs)
        return 'added'
      },
      help: { example: 'add --name John', description: 'Add a person' },
    },
    // "number" cannot have -n, so it says which letter it wants instead.
    explicit: {
      flags: {
        name: {},
        number: { short: 'u' },
      },
      handle: (handlerArgs) => {
        received(handlerArgs)
        return 'ok'
      },
    },
    // "number" takes -n on purpose, so "name" silently loses its automatic letter.
    stolen: {
      flags: {
        name: {},
        number: { short: 'n' },
      },
      handle: (handlerArgs) => {
        received(handlerArgs)
        return 'ok'
      },
    },
    // Both want -n and neither says otherwise, so the command refuses to run.
    conflicting: {
      flags: {
        name: {},
        number: {},
      },
      handle: () => 'never reached',
    },
    // No flags block at all, so anything goes.
    free: {
      handle: (handlerArgs) => {
        received(handlerArgs)
        return 'ok'
      },
    },
  }

  const type = async (commandLine: string) => {
    const user = userEvent.setup()
    render(<Terminal commands={declaredCommands} />)

    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, `${commandLine}{enter}`)
  }

  // Types a command line and returns what the handler received.
  const run = async (commandLine: string) => {
    await type(commandLine)
    return received.mock.lastCall?.[0] as CommandHandlerArgs
  }

  beforeEach(() => {
    received.mockClear()
  })

  test('gives a flag its first letter as short form', async () => {
    const { flags } = await run('add -n John Doe -c New York')

    expect(flags).toEqual({ name: 'John Doe', city: 'New York' })
  })

  test('accepts the long form too', async () => {
    const { flags } = await run('add --name John Doe')

    expect(flags).toEqual({ name: 'John Doe' })
  })

  test('lets an explicit short form win, and the loser gets none', async () => {
    const { flags } = await run('explicit -u 42 --name John')

    expect(flags).toEqual({ number: '42', name: 'John' })
  })

  test('gives an explicit short form the letter another flag would take', async () => {
    const { flags } = await run('stolen -n 42')

    expect(flags).toEqual({ number: '42' })
  })

  test('keeps the long form of a flag that lost its letter', async () => {
    const { flags } = await run('stolen --name John')

    expect(flags).toEqual({ name: 'John' })
  })

  test('refuses to run when two flags declare the same short form', async () => {
    const clash: Commands = {
      add: {
        flags: { name: { short: 'n' }, number: { short: 'n' } },
        handle: () => 'never reached',
      },
    }
    render(<Terminal commands={clash} />)

    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, 'add -n Bouwe{enter}')

    expect(
      screen.getByText(/--name and --number both use -n/),
    ).toBeInTheDocument()
    expect(screen.queryByText('never reached')).not.toBeInTheDocument()
  })

  test('refuses to run a command whose short forms conflict', async () => {
    await type('conflicting --name John')

    expect(
      screen.getByText(/--name and --number both want -n/),
    ).toBeInTheDocument()
  })

  test('does not accept a long name behind a single dash', async () => {
    await type('add -name John')

    expect(received).not.toHaveBeenCalled()
    expect(screen.getByText(/Unknown flag: -name/)).toBeInTheDocument()
  })

  test('does not accept a short name behind a double dash', async () => {
    await type('add --n John')

    expect(received).not.toHaveBeenCalled()
    expect(screen.getByText(/Unknown flag: --n/)).toBeInTheDocument()
  })

  test('lists the available flags when one is unknown', async () => {
    await type('add --nmae John')

    expect(received).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Available flags: --name \(-n\), --city \(-c\)/),
    ).toBeInTheDocument()
  })

  test('accepts any flag when the command declares none', async () => {
    const { flags } = await run('free --whatever yes -x')

    expect(flags).toEqual({ whatever: 'yes', x: true })
  })

  test('shows each declared flag in help, with its description', async () => {
    await type('help')

    const log = screen.getByRole('log')

    expect(log).toHaveTextContent('--name, -n The name')
    // "city" has no description, so only its names show up.
    expect(log).toHaveTextContent('--city, -c')
  })
})

describe('Async commands', () => {
  const settle: Record<string, (value: string) => void> = {}
  const fail: Record<string, (reason: unknown) => void> = {}

  const asyncCommands: Commands = {
    hello: { handle: () => 'Hello World!' },
    slow: {
      handle: () =>
        new Promise<string>((resolve, reject) => {
          settle.slow = resolve
          fail.slow = reject
        }),
    },
    slower: {
      handle: () =>
        new Promise<string>((resolve) => {
          settle.slower = resolve
        }),
    },
  }

  const type = async (commandLine: string) => {
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, `${commandLine}{enter}`)
  }

  test('keeps the earlier output on screen while a command is pending', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('hello')
    await type('slow')

    const log = screen.getByRole('log')

    // This is the whole point: before, React suspended the log and this vanished.
    expect(within(log).getByText('Hello World!')).toBeInTheDocument()
    expect(log).toHaveTextContent('...')
  })

  test('replaces the marker with the response when it resolves', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('slow')
    expect(screen.getByRole('log')).toHaveTextContent('...')

    await act(async () => {
      settle.slow('4 users found')
    })

    expect(screen.getByText('4 users found')).toBeInTheDocument()
    expect(screen.getByRole('log')).not.toHaveTextContent('...')
  })

  test('shows the error message when a handler throws', async () => {
    const commands: Commands = {
      boom: {
        handle: () => {
          throw new Error('Something went wrong')
        },
      },
      hello: { handle: () => 'Hello World!' },
    }
    render(<Terminal commands={commands} />)

    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, 'boom{enter}')

    const log = screen.getByRole('log')
    expect(
      within(log).getByText('Error: Something went wrong'),
    ).toBeInTheDocument()
    // The command is echoed like any other, and the prompt is cleared.
    expect(within(log).getByText('boom')).toBeInTheDocument()
    expect(input).toHaveValue('')

    // The throw does not leak into whatever you type next.
    await user.type(input, 'hello{enter}')
    expect(screen.getByText('Hello World!')).toBeInTheDocument()
  })

  test('shows something readable when a handler throws a non-error', async () => {
    const commands: Commands = {
      boom: {
        handle: () => {
          throw 'just a string'
        },
      },
    }
    render(<Terminal commands={commands} />)

    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, 'boom{enter}')

    expect(screen.getByText('Error: just a string')).toBeInTheDocument()
  })

  test('shows the error message when it rejects', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('slow')

    await act(async () => {
      fail.slow(new Error('Network request failed'))
    })

    expect(
      screen.getByText('Error: Network request failed'),
    ).toBeInTheDocument()
  })

  test('shows something readable when it rejects with a non-error', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('slow')

    await act(async () => {
      fail.slow('just a string')
    })

    expect(screen.getByText('Error: just a string')).toBeInTheDocument()
  })

  test('ignores Enter while a command is running, and keeps the line', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('slow')

    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, 'hello{enter}')

    // Nothing ran, and what was typed is still sitting on the prompt.
    expect(screen.queryByText('Hello World!')).not.toBeInTheDocument()
    expect(input).toHaveValue('hello')
    expect(screen.getByRole('log')).toHaveTextContent('...')
  })

  test('accepts Enter again once the command comes back', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('slow')

    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, 'hello{enter}')

    await act(async () => {
      settle.slow('done waiting')
    })

    expect(screen.getByText('done waiting')).toBeInTheDocument()
    // Still not run, and still on the prompt, waiting for a fresh Enter.
    expect(input).toHaveValue('hello')

    await user.type(input, '{enter}')

    expect(screen.getByText('Hello World!')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  test('ignores Enter for the built in clear too', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('hello')
    await type('slow')

    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, 'clear{enter}')

    // Nothing was cleared, because nothing ran.
    expect(screen.getByText('Hello World!')).toBeInTheDocument()
    expect(input).toHaveValue('clear')
  })

  test('cancels the running command with Ctrl+C', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('slow')

    const user = userEvent.setup()
    await user.keyboard('{Control>}c{/Control}')

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByRole('log')).not.toHaveTextContent('...')
  })

  test('ignores the result of a cancelled command', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('slow')

    const user = userEvent.setup()
    await user.keyboard('{Control>}c{/Control}')

    await act(async () => {
      settle.slow('too late')
    })

    expect(screen.queryByText('too late')).not.toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  test('leaves Ctrl+C alone when text is selected, so copy still works', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('slow')

    const selection = vi
      .spyOn(window, 'getSelection')
      .mockReturnValue({ isCollapsed: false } as Selection)

    const user = userEvent.setup()
    await user.keyboard('{Control>}c{/Control}')

    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument()
    expect(screen.getByRole('log')).toHaveTextContent('...')

    selection.mockRestore()
  })

  test('keeps the typed line when Ctrl+C cancels a running command', async () => {
    render(<Terminal commands={asyncCommands} />)

    await type('slow')

    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, 'hello')
    await user.keyboard('{Control>}c{/Control}')

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    // What was typed while waiting survives, and can now be run.
    expect(input).toHaveValue('hello')

    await user.type(input, '{enter}')
    expect(screen.getByText('Hello World!')).toBeInTheDocument()
  })

  test('clears the typed line on Ctrl+C when nothing is running', async () => {
    render(<Terminal commands={asyncCommands} />)

    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })

    await user.type(input, 'half typed')
    await user.keyboard('{Control>}c{/Control}')

    expect(input).toHaveValue('')
  })
})

describe('Prompt and welcome message', () => {
  const commands: Commands = {
    hello: { handle: () => 'Hello World!' },
  }

  const type = async (commandLine: string) => {
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, `${commandLine}{enter}`)
  }

  test('shows a > prompt when none is given', () => {
    render(<Terminal commands={commands} />)

    expect(screen.getByText('>')).toBeInTheDocument()
  })

  test('uses a custom prompt on the line you type', () => {
    render(<Terminal commands={commands} prompt="bouwe@replikateur $" />)

    expect(screen.getByText('bouwe@replikateur $')).toBeInTheDocument()
    expect(screen.queryByText('>')).not.toBeInTheDocument()
  })

  test('uses a custom prompt in the history too', async () => {
    render(<Terminal commands={commands} prompt="$" />)

    await type('hello')

    const log = screen.getByRole('log')
    expect(within(log).getByText('$')).toBeInTheDocument()
  })

  test('shows no welcome message when none is given', () => {
    const { container } = render(<Terminal commands={commands} />)

    expect(container.textContent).toBe('>')
  })

  test('shows the welcome message above the prompt', () => {
    render(<Terminal commands={commands} welcome="Welcome to my terminal!" />)

    expect(screen.getByText('Welcome to my terminal!')).toBeInTheDocument()
  })

  test('keeps the welcome message when a command runs', async () => {
    render(<Terminal commands={commands} welcome="Welcome!" />)

    await type('hello')

    expect(screen.getByText('Welcome!')).toBeInTheDocument()
    expect(screen.getByText('Hello World!')).toBeInTheDocument()
  })

  test('removes the welcome message on clear, so the screen is empty', async () => {
    render(<Terminal commands={commands} welcome="Welcome!" />)

    await type('hello')
    await type('clear')

    expect(screen.queryByText('Welcome!')).not.toBeInTheDocument()
    expect(screen.queryByText('Hello World!')).not.toBeInTheDocument()
  })
})

describe('Flags written with an equals sign', () => {
  const received = vi.fn()

  const commands: Commands = {
    add: {
      flags: { name: {}, city: {} },
      handle: (handlerArgs) => {
        received(handlerArgs)
        return 'ok'
      },
    },
    free: {
      handle: (handlerArgs) => {
        received(handlerArgs)
        return 'ok'
      },
    },
  }

  const run = async (commandLine: string) => {
    const user = userEvent.setup()
    render(<Terminal commands={commands} />)
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, `${commandLine}{enter}`)
    return received.mock.lastCall?.[0] as CommandHandlerArgs
  }

  beforeEach(() => {
    received.mockClear()
  })

  test('takes the value after the equals sign', async () => {
    const { flags } = await run('add --name=John')

    expect(flags).toEqual({ name: 'John' })
  })

  test('works with a short form too', async () => {
    const { flags } = await run('add -n=John')

    expect(flags).toEqual({ name: 'John' })
  })

  test('keeps later equals signs in the value', async () => {
    const { flags } = await run('free --filter=a=b')

    expect(flags).toEqual({ filter: 'a=b' })
  })

  test('still takes the words that follow', async () => {
    const { flags } = await run('add --name=John Doe --city=New York')

    expect(flags).toEqual({ name: 'John Doe', city: 'New York' })
  })

  test('gives an empty string when nothing follows the equals sign', async () => {
    const { flags } = await run('add --name=')

    expect(flags).toEqual({ name: '' })
  })
})

describe('help for a single command', () => {
  const commands: Commands = {
    add: {
      flags: { name: { description: 'The name' } },
      handle: () => 'ok',
      help: { example: 'add --name John', description: 'Add a person' },
    },
    hello: {
      handle: () => 'hi',
      help: { example: 'hello', description: 'Say hello' },
    },
    yolo: { handle: () => 'YOLO' },
  }

  const type = async (commandLine: string) => {
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, `${commandLine}{enter}`)
  }

  test('shows only the command you asked for', async () => {
    render(<Terminal commands={commands} />)

    await type('help add')

    const log = screen.getByRole('log')
    expect(log).toHaveTextContent('add --name John - Add a person')
    expect(log).toHaveTextContent('--name, -n The name')
    expect(log).not.toHaveTextContent('Say hello')
    expect(log).not.toHaveTextContent('Available commands:')
  })

  test('works for the built in commands too', async () => {
    render(<Terminal commands={commands} />)

    await type('help clear')

    expect(screen.getByRole('log')).toHaveTextContent(
      'clear - Clear the screen',
    )
  })

  test('says so when the command does not exist', async () => {
    render(<Terminal commands={commands} />)

    await type('help nope')

    expect(screen.getByText('Unknown command: nope')).toBeInTheDocument()
  })

  test('says so when the command has no help', async () => {
    render(<Terminal commands={commands} />)

    await type('help yolo')

    expect(screen.getByText('No help for "yolo"')).toBeInTheDocument()
  })

  test('still lists everything for a bare help', async () => {
    render(<Terminal commands={commands} />)

    await type('help')

    const log = screen.getByRole('log')
    expect(log).toHaveTextContent('Available commands:')
    expect(log).toHaveTextContent('Say hello')
    expect(log).toHaveTextContent('Add a person')
  })
})

describe('Ctrl+C on an idle prompt', () => {
  const commands: Commands = {
    hello: { handle: () => 'Hello World!' },
  }

  test('leaves the abandoned line in the history', async () => {
    render(<Terminal commands={commands} />)

    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, 'half typed')
    await user.keyboard('{Control>}c{/Control}')

    expect(screen.getByText('half typed^C')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  test('does not recall an abandoned line with ArrowUp', async () => {
    render(<Terminal commands={commands} />)

    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })

    await user.type(input, 'hello{enter}')
    await user.type(input, 'half typed')
    await user.keyboard('{Control>}c{/Control}')

    await user.type(input, '{arrowup}')

    // The last real command, not the line that was thrown away.
    expect(input).toHaveValue('hello')
  })
})

describe('Subcommands', () => {
  const received = vi.fn()

  const commands: Commands = {
    user: {
      handle: () => 'the user command',
      help: { example: 'user', description: 'The user itself' },
    },
    'user add': {
      flags: { force: { description: 'Do it anyway' } },
      handle: (handlerArgs) => {
        received(handlerArgs)
        return 'added'
      },
      help: { example: 'user add <name>', description: 'Add a user' },
    },
  }

  const type = async (commandLine: string) => {
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, `${commandLine}{enter}`)
  }

  beforeEach(() => {
    received.mockClear()
  })

  test('runs the longest matching name', async () => {
    render(<Terminal commands={commands} />)

    await type('user add bob')

    expect(screen.getByText('added')).toBeInTheDocument()

    const { input, args, rawInput } = received.mock
      .lastCall?.[0] as CommandHandlerArgs
    expect(input).toBe('bob')
    expect(args).toEqual(['bob'])
    expect(rawInput).toBe('user add bob')
  })

  test('falls back to the shorter name when the longer one does not match', async () => {
    render(<Terminal commands={commands} />)

    await type('user remove bob')

    expect(screen.getByText('the user command')).toBeInTheDocument()
  })

  test('reads flags of the subcommand, not of the shorter name', async () => {
    render(<Terminal commands={commands} />)

    await type('user add bob --force')

    const { flags } = received.mock.lastCall?.[0] as CommandHandlerArgs
    expect(flags).toEqual({ force: true })
  })

  test('shows help for a subcommand', async () => {
    render(<Terminal commands={commands} />)

    await type('help user add')

    const log = screen.getByRole('log')
    expect(log).toHaveTextContent('user add <name> - Add a user')
    expect(log).not.toHaveTextContent('The user itself')
  })

  test('does not run a subcommand by its first word alone', async () => {
    render(<Terminal commands={{ 'user add': { handle: () => 'added' } }} />)

    await type('user')

    expect(screen.getByText('Unknown command: user')).toBeInTheDocument()
  })
})

describe('Mistakes in a command definition', () => {
  const problems = () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    return {
      spy,
      messages: () => spy.mock.calls.map((call) => String(call[0])),
    }
  }

  test('reports a command name that is not spaced with single spaces', () => {
    const { spy, messages } = problems()

    render(<Terminal commands={{ 'user  add': { handle: () => 'x' } }} />)

    expect(messages().join('\n')).toContain(
      '"user  add" is not spaced with single spaces',
    )
    spy.mockRestore()
  })

  test('reports a word of a command name that starts with a dash', () => {
    const { spy, messages } = problems()

    render(<Terminal commands={{ 'user -x': { handle: () => 'x' } }} />)

    expect(messages().join('\n')).toContain('reads as a flag')
    spy.mockRestore()
  })

  test('reports a command name that starts with a dash', () => {
    const { spy, messages } = problems()

    render(<Terminal commands={{ '-x': { handle: () => 'x' } }} />)

    expect(messages().join('\n')).toContain('reads as a flag')
    spy.mockRestore()
  })

  test('reports a short form that is not a single letter', () => {
    const { spy, messages } = problems()

    render(
      <Terminal
        commands={{
          add: { flags: { name: { short: 'nm' } }, handle: () => 'x' },
        }}
      />,
    )

    expect(messages().join('\n')).toContain('must be a single letter')
    spy.mockRestore()
  })

  test('reports a command without a handle function', () => {
    const { spy, messages } = problems()

    const broken = { nope: {} } as unknown as Commands
    render(<Terminal commands={broken} />)

    expect(messages().join('\\n')).toContain('"nope" has no handle function')
    spy.mockRestore()
  })

  test('reports a flag name that can never be typed', () => {
    const { spy, messages } = problems()

    render(
      <Terminal
        commands={{ add: { flags: { 'my flag': {} }, handle: () => 'x' } }}
      />,
    )

    expect(messages().join('\\n')).toContain('can never be typed')
    spy.mockRestore()
  })

  test('says nothing about a healthy set of commands', () => {
    const { spy, messages } = problems()

    render(
      <Terminal
        commands={{
          add: { flags: { name: { short: 'n' } }, handle: () => 'x' },
        }}
      />,
    )

    expect(messages()).toEqual([])
    spy.mockRestore()
  })
})

describe('A changing prompt', () => {
  // Swapping commands and prompt is how you build a REPL from the outside, and
  // it is what makes a retroactively rewritten history visible.
  const App = () => {
    const [inRepl, setInRepl] = useState(false)

    const shell: Commands = {
      enter: {
        handle: () => {
          setInRepl(true)
          return 'entered'
        },
      },
      hello: { handle: () => 'Hello from the shell' },
    }

    const repl: Commands = {
      sing: { handle: () => 'La la la' },
      exit: {
        handle: () => {
          setInRepl(false)
          return 'left'
        },
      },
    }

    return (
      <Terminal
        commands={inRepl ? repl : shell}
        prompt={inRepl ? 'repl>' : '>'}
      />
    )
  }

  const type = async (commandLine: string) => {
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, `${commandLine}{enter}`)
  }

  test('keeps the prompt each line was typed at', async () => {
    render(<App />)

    await type('hello')
    await type('enter')
    await type('sing')

    const log = screen.getByRole('log')

    // The two shell lines keep ">", only the line typed inside the repl has "repl>".
    expect(within(log).getAllByText('>')).toHaveLength(2)
    expect(within(log).getAllByText('repl>')).toHaveLength(1)
  })

  test('does not rewrite the history again on the way back', async () => {
    render(<App />)

    await type('enter')
    await type('sing')
    await type('exit')
    await type('hello')

    const log = screen.getByRole('log')

    // "enter" and "hello" at ">", "sing" and "exit" at "repl>".
    expect(within(log).getAllByText('>')).toHaveLength(2)
    expect(within(log).getAllByText('repl>')).toHaveLength(2)
  })

  test('scopes the commands to the mode you are in', async () => {
    render(<App />)

    await type('enter')
    await type('hello')

    expect(screen.getByText('Unknown command: hello')).toBeInTheDocument()
  })
})

// RTL's `screen` and the terminal's own `screen` would shadow each other, so the
// handler argument is renamed everywhere in here.
describe('Screens', () => {
  const Editor = ({ onExit }: { onExit: () => void }) => (
    <div>
      <p>Editing away</p>
      <button onClick={onExit}>quit</button>
    </div>
  )

  const screenCommands: Commands = {
    hello: { handle: () => 'Hello World!' },
    edit: {
      handle: ({ screen: terminal }) =>
        terminal.open(<Editor onExit={terminal.close} />),
    },
    leave: {
      handle: ({ screen: terminal }) => terminal.close(),
    },
  }

  const type = async (commandLine: string) => {
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: /command/i })
    await user.type(input, `${commandLine}{enter}`)
  }

  test('takes over the terminal, prompt and all', async () => {
    render(<Terminal commands={screenCommands} welcome="Welcome" />)

    await type('hello')
    await type('edit')

    expect(screen.getByText('Editing away')).toBeInTheDocument()

    // Nothing of the terminal is left: no history, no welcome, and above all no
    // input, so it cannot take the keys the screen is listening for.
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
    expect(screen.queryByText('Welcome')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: /command/i }),
    ).not.toBeInTheDocument()
  })

  test('gives the history back untouched when it closes', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={screenCommands} />)

    await type('hello')
    await type('edit')
    await user.click(screen.getByRole('button', { name: 'quit' }))

    expect(screen.queryByText('Editing away')).not.toBeInTheDocument()

    const log = screen.getByRole('log')
    expect(within(log).getByText('Hello World!')).toBeInTheDocument()
    // The line that opened the screen is echoed like any other command.
    expect(within(log).getByText('edit')).toBeInTheDocument()
  })

  test('focuses the prompt again when it closes', async () => {
    const user = userEvent.setup()
    render(<Terminal commands={screenCommands} />)

    await type('edit')
    await user.click(screen.getByRole('button', { name: 'quit' }))

    expect(screen.getByRole('textbox', { name: /command/i })).toHaveFocus()
  })

  test('a screen opened by an async command behaves the same', async () => {
    let openSlowly: () => void = () => {}

    const commands: Commands = {
      slow: {
        handle: ({ screen: terminal }) =>
          new Promise<null>((resolve) => {
            openSlowly = () => {
              terminal.open(<Editor onExit={terminal.close} />)
              resolve(null)
            }
          }),
      },
    }

    render(<Terminal commands={commands} />)

    await type('slow')
    expect(screen.getByRole('log')).toHaveTextContent('...')

    await act(async () => {
      openSlowly()
    })

    expect(screen.getByText('Editing away')).toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
  })

  test('closing when no screen is open does nothing', async () => {
    render(<Terminal commands={screenCommands} />)

    await type('leave')

    const log = screen.getByRole('log')
    expect(within(log).getByText('leave')).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /command/i }),
    ).toBeInTheDocument()
  })
})

const cssVar = (name: string) =>
  screen.getByRole('presentation').style.getPropertyValue(`--replikateur-${name}`)

describe('Cursor shape and blink', () => {
  const commands: Commands = { hello: { handle: () => 'Hello World!' } }

  const caretVars = () => [cssVar('caret-shape'), cssVar('caret-animation')]

  test('defaults to a blinking bar', () => {
    render(<Terminal commands={commands} />)
    expect(caretVars()).toEqual(['bar', 'auto'])
  })

  test('a shape on its own keeps the blinking', () => {
    render(<Terminal commands={commands} cursor={{ shape: 'underscore' }} />)
    expect(caretVars()).toEqual(['underscore', 'auto'])
  })

  test('a block cursor that does not blink', () => {
    render(
      <Terminal
        commands={commands}
        cursor={{ shape: 'block', blink: false }}
      />,
    )
    expect(caretVars()).toEqual(['block', 'manual'])
  })
})

describe('Theme and size', () => {
  const commands: Commands = { hello: { handle: () => 'Hello World!' } }

  test('sets nothing of its own, so the CSS defaults decide', () => {
    render(<Terminal commands={commands} />)

    expect(cssVar('background')).toBe('')
    expect(cssVar('font-size')).toBe('')
    expect(cssVar('width')).toBe('')
    expect(cssVar('height')).toBe('')
  })

  test('passes theme values through as they are', () => {
    render(
      <Terminal
        commands={commands}
        theme={{
          background: '#001b1b',
          foreground: 'papayawhip',
          promptColor: 'cyan',
          responseColor: 'rgb(180 180 180)',
          fontFamily: 'Fira Code, monospace',
          fontSize: '1.1rem',
          padding: '2em',
        }}
      />,
    )

    expect(cssVar('background')).toBe('#001b1b')
    expect(cssVar('foreground')).toBe('papayawhip')
    expect(cssVar('prompt-color')).toBe('cyan')
    expect(cssVar('response-color')).toBe('rgb(180 180 180)')
    expect(cssVar('font-family')).toBe('Fira Code, monospace')
    expect(cssVar('font-size')).toBe('1.1rem')
    expect(cssVar('padding')).toBe('2em')
  })

  test('a terminal in a box instead of the whole page', () => {
    render(
      <Terminal
        commands={commands}
        size={{ width: '600px', height: '400px' }}
      />,
    )

    expect(cssVar('width')).toBe('600px')
    expect(cssVar('height')).toBe('400px')
  })

  test('one side of the size on its own leaves the other to the CSS', () => {
    render(<Terminal commands={commands} size={{ height: '50vh' }} />)

    expect(cssVar('height')).toBe('50vh')
    expect(cssVar('width')).toBe('')
  })
})
