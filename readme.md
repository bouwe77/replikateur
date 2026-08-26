# Kanza

**A lightweight, customizable terminal emulator component for React.**

## Kanza?

> _"Kanza, at the time of the ripening"_

A metaphor for being ready or reaching a finished state, from the [Star Trek - The Next Generation episode "Darmok"](https://memory-alpha.fandom.com/wiki/Kanza)

In the fictional Tamarian language, the word _"Kanza"_ refers to the moment a process is fully grown and ready to use, much like a terminal environment that has finished loading and is waiting for your command.

## Getting started

```bash
npm i kanza
```

Import the `Terminal` component and the styles:

```tsx
import { Terminal, type Commands } from 'kanza'
import 'kanza/style.css'

const commands: Commands = {
  hello: {
    handle: () => 'Hi there!',
    help: { example: 'hello', description: 'Say hello' },
  },
}

function App() {
  return <Terminal commands={commands} />
}
```

The library source lives in `src/kanza`.

## Development


The Node version is pinned in `.tool-versions`, for asdf or mise.

Install the dependencies once:

```bash
npm install
```

### Run the demo app

```bash
npm run dev
```

This starts the demo app in `index.html` and `src/main.tsx`. It imports the
library straight from the source, so changes show up immediately through HMR.
Its commands are defined in `src/commands.ts`.

### Run the tests

```bash
npm test        # watch mode
npm run test:ui # watch mode with the Vitest UI
npm run coverage
```

### Build the library

```bash
npm run build
```

This type checks the project and builds the library into `dist`:

| File                  | What it is                       |
| --------------------- | -------------------------------- |
| `kanza.js`   | The library, ES module           |
| `kanza.css`  | The styles, must be imported too |
| `kanza.d.ts` | The TypeScript types             |

React is not bundled. It is a peer dependency, so the app that uses the library
brings its own copy.

## Quick testing against the build

The demo app uses the source. To check what people actually get when they
install the library, use the quick test app:

```bash
./create-app-for-quick-testing.sh
```

The script:

1. Builds the library into `dist`.
2. Wipes and recreates the `app-for-quick-testing` folder with a minimal React
   app that imports `Terminal` and the styles from `dist`.
3. Starts that app on http://localhost:5173.

Try `help`, `clear`, and the commands in `app-for-quick-testing/commands.js`.

The folder is generated, so do not edit it: every run wipes it. It is in
`.gitignore` and has no dependencies of its own. Vite, React and the React
plugin are resolved from the `node_modules` of this repo, so there is nothing
to install and there is only one copy of React.

Run the script again after every library change, because the app uses the build
and not the source.

## Publish to npm

```bash
./publish.sh patch   # or minor, or major
```

This installs, bumps the version, builds, publishes to npm and pushes the tag.
