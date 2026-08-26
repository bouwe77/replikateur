import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import commands from './commands'
import { Terminal, type Commands } from './kanza'

// A nested REPL, built entirely from the outside: swap the commands and the
// prompt, and everything else keeps working. The library needs no support for
// this, and the history keeps the prompt each line was typed at.
const App = () => {
  const [inOompa, setInOompa] = useState(false)

  const shell: Commands = {
    ...commands,
    oompa: {
      handle: () => {
        setInOompa(true)
        return 'You are in the chocolate factory. Type "exit" to leave.'
      },
      help: { example: 'oompa', description: 'Enter the oompa loompa REPL' },
    },
  }

  const oompa: Commands = {
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
      prompt={inOompa ? 'oompa>' : 'kanza $'}
      welcome={'Welcome to Kanza.\nType "help" to see what it can do.'}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
