import type { Commands } from './kanza'

const commands: Commands = {
  hello: {
    handle: () => {
      return 'Hello to you too :)'
    },
    help: {
      example: 'hello',
      description: 'Say hello to the terminal',
    },
  },

  'no-response': {
    handle: () => {},
    help: {
      example: 'no-response',
      description: 'A command that does not return anything',
    },
  },

  // Without flags, everything behind the command is one string,
  // so "go New York" keeps the two words together.
  go: {
    handle: ({ input }) => {
      if (!input) return 'Where should we go?'

      return `OK, let's go ${input}`
    },
    help: {
      example: 'go north',
      description: 'Go in a specified direction',
    },
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
      example: 'add --name John Doe --city=Amsterdam',
      description: 'Add a person, using flags for the values',
    },
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

      return new Promise<string>((resolve) =>
        setTimeout(() => resolve(`Waited ${seconds} seconds`), seconds * 1000),
      )
    },
    help: {
      example: 'wait 3',
      description: 'Wait a number of seconds, then answer',
    },
  },

  yolo: {
    // no help provided for this command, so it won't show up in "help"
    handle: () => 'YOLO',
  },
}

export default commands
