import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { Commands, Terminal } from './index'

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
    expect(within(log).getByText('> hello')).toBeInTheDocument()
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
