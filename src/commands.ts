import type { Commands } from './react-terminal'

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

  go: {
    handle: ({ args }) => {
      const direction = args[0]
      if (!direction) return 'Where should we go?'

      return `OK, let's go ${direction}`
    },
    help: {
      example: 'go north',
      description: 'Go in a specified direction',
    },
  },

  yolo: {
    // no help provided for this command, so it won't show up in "help"
    handle: () => 'YOLO',
  },
}

export default commands
