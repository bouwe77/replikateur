import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Terminal } from '../dist/kanza.js'
import '../dist/kanza.css'
import commands from './commands.jsx'

// Every Terminal prop that is not a command, flat, so one input maps to one
// value. It is turned back into the nested props shape in <App />.
const DEFAULTS = {
  prompt: '$',
  welcome:
    'Welcome to kanza! Type "help" to see what you can do here.\nChange anything on the right and watch it apply right away.',
  shape: 'block',
  blink: true,
  background: '#1a0033',
  foreground: '#f6e9ff',
  promptColor: '#ff2fb9',
  responseColor: '#5ef1ff',
  fontFamily: "'Menlo', 'Monaco', monospace",
  fontSize: 18,
  padding: 24,
  width: '100%',
  height: '100vh',
}

const FONTS = [
  "'Courier New', monospace",
  "'Menlo', 'Monaco', monospace",
  "'Comic Sans MS', cursive",
  'Georgia, serif',
  'system-ui, sans-serif',
]

// Which input each setting gets. Anything not listed here is a text input.
const FIELDS = [
  { key: 'prompt', label: 'prompt' },
  { key: 'welcome', label: 'welcome', type: 'textarea' },
  { key: 'shape', label: 'cursor.shape', options: ['bar', 'block', 'underscore'] },
  { key: 'blink', label: 'cursor.blink', type: 'checkbox' },
  { key: 'background', label: 'theme.background', type: 'color' },
  { key: 'foreground', label: 'theme.foreground', type: 'color' },
  { key: 'promptColor', label: 'theme.promptColor', type: 'color' },
  { key: 'responseColor', label: 'theme.responseColor', type: 'color' },
  { key: 'fontFamily', label: 'theme.fontFamily', options: FONTS },
  { key: 'fontSize', label: 'theme.fontSize', type: 'range', min: 10, max: 32 },
  { key: 'padding', label: 'theme.padding', type: 'range', min: 0, max: 60 },
  { key: 'width', label: 'size.width' },
  { key: 'height', label: 'size.height' },
]

const Field = ({ field, value, onChange }) => {
  const { key, label, type, options, min, max } = field

  const input = options ? (
    <select value={value} onChange={(e) => onChange(key, e.target.value)}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  ) : type === 'textarea' ? (
    <textarea
      rows={3}
      value={value}
      onChange={(e) => onChange(key, e.target.value)}
    />
  ) : type === 'checkbox' ? (
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onChange(key, e.target.checked)}
    />
  ) : type === 'range' ? (
    <span className="rangeRow">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(key, Number(e.target.value))}
      />
      <code>{value}px</code>
    </span>
  ) : (
    <input
      type={type ?? 'text'}
      value={value}
      onChange={(e) => onChange(key, e.target.value)}
    />
  )

  return (
    <label className="field">
      <span>{label}</span>
      {input}
    </label>
  )
}

const App = () => {
  const [settings, setSettings] = useState(DEFAULTS)

  // A nested REPL, built entirely from the outside: swap the commands and the
  // prompt, and everything else keeps working. The library needs no support for
  // this, and the history keeps the prompt each line was typed at.
  const [inOompa, setInOompa] = useState(false)

  const set = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }))

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

  const props = {
    prompt: inOompa ? 'oompa>' : settings.prompt,
    welcome: settings.welcome,
    cursor: { shape: settings.shape, blink: settings.blink },
    theme: {
      background: settings.background,
      foreground: settings.foreground,
      promptColor: settings.promptColor,
      responseColor: settings.responseColor,
      fontFamily: settings.fontFamily,
      fontSize: `${settings.fontSize}px`,
      padding: `${settings.padding}px`,
    },
    size: { width: settings.width, height: settings.height },
  }

  return (
    <div className="layout">
      <div className="terminalPane">
        <Terminal commands={inOompa ? oompa : shell} {...props} />
      </div>

      <aside className="panel">
        <h1>kanza settings</h1>
        <p>Everything here is a prop. Change it and the terminal follows.</p>

        <p>
          The same library without React and without a bundler:{' '}
          <a href="/embed.html" style={{ color: '#9fd' }}>
            the embed demo
          </a>
          .
        </p>

        {FIELDS.map((field) => (
          <Field
            key={field.key}
            field={field}
            value={settings[field.key]}
            onChange={set}
          />
        ))}

        <button onClick={() => setSettings(DEFAULTS)}>Reset to defaults</button>

        <h2>These props</h2>
        <pre>{JSON.stringify(props, null, 2)}</pre>
      </aside>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
