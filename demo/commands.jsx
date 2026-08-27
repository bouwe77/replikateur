import { useEffect, useState } from 'react'

const FLAVOURS = ['Chocolate', 'Strawberry', 'Blueberry', 'Snozzberry']

// Somewhere for the user subcommands to keep what you add, for as long as the
// page is open.
const users = []

const KEYS = ['ArrowDown', 'ArrowUp', 'Enter', 'q', 'Escape']

// Written by hand, on purpose. A screen is a plain React component: it knows
// nothing about the terminal, it only gets an onExit from whoever opened it.
// It listens on the window because the prompt is gone while it is open, so
// there is nothing left to fight over the keyboard with.
const Menu = ({ onExit }) => {
  const [selected, setSelected] = useState(0)
  const [picked, setPicked] = useState(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      const last = FLAVOURS.length - 1

      // A key this screen uses is its own, so the browser must not also act on
      // it. Without this the arrows scroll the page, and the "q" that closes
      // the screen is typed into the prompt that comes back underneath it.
      if (!KEYS.includes(e.key)) return
      e.preventDefault()

      if (e.key === 'ArrowDown') setSelected((i) => (i === last ? 0 : i + 1))
      if (e.key === 'ArrowUp') setSelected((i) => (i === 0 ? last : i - 1))
      if (e.key === 'Enter') setPicked(FLAVOURS[selected])
      if (e.key === 'q' || e.key === 'Escape') onExit()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, onExit])

  return (
    <div style={{ whiteSpace: 'pre' }}>
      Pick a flavour. Arrows to move, Enter to pick, q to leave.
      <br />
      <br />
      {FLAVOURS.map((flavour, index) => (
        <div key={flavour}>
          {index === selected ? '> ' : '  '}
          {flavour}
        </div>
      ))}
      <br />
      {picked ? `You picked ${picked}.` : ' '}
    </div>
  )
}

const commands = {
  hello: {
    handle: () => 'Hello to you too :)',
    help: { example: 'hello', description: 'Say hello to the terminal' },
  },

  // Without flags, everything behind the command is one string,
  // so "go New York" keeps the two words together.
  go: {
    handle: ({ input }) => {
      if (!input) return 'Where should we go?'

      return `OK, let's go ${input}`
    },
    help: { example: 'go north', description: 'Go in a specified direction' },
  },

  // With flags, each flag separates its own value,
  // so both values can be more than one word.
  add: {
    // Declaring flags gives you -n and -c for free, a description in "help",
    // and an error when someone types a flag that does not exist.
    flags: {
      name: { description: 'The name of the person' },
      city: { description: 'Where they live' },
    },
    handle: ({ flags }) => {
      const name = typeof flags.name === 'string' ? flags.name : ''
      const city = typeof flags.city === 'string' ? flags.city : ''

      if (!name) return 'Who should I add? For example: add --name John Doe'

      return city ? `Added ${name} from ${city}` : `Added ${name}`
    },
    help: {
      example: 'add --name John Doe --city New York',
      description: 'Add a person, using flags for the values',
    },
  },

  // A subcommand: the name is two words, so "user add" is its own command with
  // its own flags and its own help. The longest name that matches wins, which
  // is why "user add bob" does not end up at "user".
  user: {
    handle: () => 'Try "user add <name>" or "user list".',
    help: { example: 'user', description: 'What you can do with users' },
  },

  'user add': {
    flags: { admin: { description: 'Make them an admin' } },
    handle: ({ input, flags }) => {
      if (!input) return 'Who should I add? For example: user add Bob'

      users.push(flags.admin ? `${input} (admin)` : input)

      return `Added ${input}`
    },
    help: {
      example: 'user add Bob --admin',
      description: 'Add a user, an admin one if you like',
    },
  },

  'user list': {
    handle: () => (users.length ? users.join('\n') : 'Nobody here yet.'),
    help: { example: 'user list', description: 'List everyone you added' },
  },

  // Not async on purpose: bad input throws straight away, which is a sync throw,
  // and the waiting itself is the promise. Both show up as "Error: ..." in the
  // history, which is the whole point of the contract.
  wait: {
    handle: ({ input }) => {
      if (!input) throw new Error('How long should I wait? For example: wait 3')

      const seconds = Number(input)

      if (Number.isNaN(seconds)) throw new Error(`"${input}" is not a number`)

      if (seconds < 0 || seconds > 10) {
        throw new Error('Pick something between 0 and 10 seconds')
      }

      return new Promise((resolve) =>
        setTimeout(() => resolve(`Waited ${seconds} seconds`), seconds * 1000),
      )
    },
    help: {
      example: 'wait 3',
      description: 'Wait a number of seconds, then answer',
    },
  },

  // A screen: the terminal shows something else until you leave it, and the
  // history is waiting for you when you get back.
  menu: {
    handle: ({ screen }) => screen.open(<Menu onExit={screen.close} />),
    help: {
      example: 'menu',
      description: 'Open a screen you can move around in',
    },
  },

  yolo: {
    // No help provided, so this one does not show up in "help"
    handle: () => 'YOLO',
  },
}

export default commands
