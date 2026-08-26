#!/bin/bash

# Creates a React app on the fly, to quickly test against the local build in the dist folder.

# Build kanza into the dist folder
npm run build

# The CSS file name is decided by Vite, so look it up instead of hardcoding it
css=$(basename dist/*.css)

# Remove the current folder
rm -rf app-for-quick-testing

# Create the folder again with some minimal files
mkdir app-for-quick-testing
cd app-for-quick-testing

# Create the page that hosts the app
cat > index.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>kanza quick test</title>
  </head>
  <body style="background-color: black">
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>
EOF

# Create main.jsx that imports the Terminal and its styles from the dist folder
cat > main.jsx <<EOF
import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Terminal } from '../dist/kanza.js'
import '../dist/$css'
import commands from './commands.js'


// A nested REPL, built entirely from the outside: swap the commands and the
// prompt, and everything else keeps working. The library needs no support for
// this, and the history keeps the prompt each line was typed at.
const App = () => {
  const [inOompa, setInOompa] = useState(false)

  const shell = {
    ...commands,
    oompa: {
      handle: () => {
        setInOompa(true)
        return 'You are in the chocolate factory. Type "exit" to leave.'
      },
      help: { example: 'oompa', description: 'Enter the oompa loompa REPL' },
    },
  }

  const oompa = {
    sing: {
      handle: () => '♪ Oompa loompa doompety doo ♫',
      help: { example: 'sing', description: 'Sing a song' },
    },
    exit: {
      handle: () => {
        setInOompa(false)
      },
      help: { example: 'exit', description: 'Leave the REPL' },
    },
  }

  return (
    <Terminal
      commands={inOompa ? oompa : shell}
      prompt={inOompa ? 'oompa>' : '$'}
      welcome={'Welcome! Type "help" to see what you can do here.'}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

# Create a few commands to try out, next to the built in "help" and "clear"
cat > commands.js <<'EOF'
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

  yolo: {
    // No help provided, so this one does not show up in "help"
    handle: () => 'YOLO',
  },
}

export default commands
EOF

# Create a Vite config. The app imports from ../dist, which is outside this
# folder, so Vite needs permission to serve files from the parent folder.
cat > vite.config.js <<'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
EOF

# Create package.json to start the app with `npm run dev`. There are no
# dependencies here on purpose: vite, react and the react plugin are resolved
# from the node_modules of the repo one folder up.
cat > package.json <<'EOF'
{
  "type": "module",
  "scripts": {
    "dev": "vite"
  }
}
EOF

# Create a readme to explain what this is
cat > README.md <<'EOF'
# kanza app for quick testing

This app is created on the fly to quickly test kanza against the local
build in the `dist` folder. Do not edit it, it is wiped and recreated every time
you run `./create-app-for-quick-testing.sh`.
EOF

# Start the just created app
echo "🚀 Starting the quick test app..."
npm run dev
