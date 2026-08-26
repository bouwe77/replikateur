import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Terminal } from '../dist/kanza.js'
import '../dist/kanza.css'
import commands from './commands.jsx'

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
