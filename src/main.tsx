import React from 'react'
import ReactDOM from 'react-dom/client'
import commands from './commands'
import { Terminal } from './react-terminal'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Terminal commands={commands} />
  </React.StrictMode>,
)
