# Replikateur

**A lightweight, customizable terminal emulator component for React.**

A terminal in a React component. You bring the commands.

## Replikateur?

German and French for "replicator", the Star Trek machine that makes what you
ask it for. You type a command, something appears.

## Getting started

### Install

```bash
npm install replikateur
```

### Usage

```jsx
import { Terminal } from 'replikateur'
import 'replikateur/style.css'

const commands = {
  hello: {
    handle: () => 'Hello to you too :)',
    help: { example: 'hello', description: 'Say hello' },
  },
}

export default function App() {
  return <Terminal commands={commands} />
}
```

`help` and `clear` are there already. `help` on its own lists everything, and
`help <command>` shows one command. Define your own command with either name to
take it over.

### Without a build step

There is a second build: one JavaScript file with React, the component and the
styles inside it. You drop it in a `<script>` tag and call `window.Replikateur.init`.
Nothing to install, no bundler.

Every npm package is served by public CDNs, so the file is a URL as soon as a
version is published:

```
https://cdn.jsdelivr.net/npm/replikateur/dist/replikateur.embed.js
https://unpkg.com/replikateur/dist/replikateur.embed.js
```

Those URLs give you the newest version. Pin one in production, so a new release
cannot change your page without you: put `@` and a version number after the
name, like `replikateur@1.2.3/dist/replikateur.embed.js`. The version numbers are on
[npmjs.com/package/replikateur](https://www.npmjs.com/package/replikateur).

```html
<div id="terminal"></div>

<script src="https://cdn.jsdelivr.net/npm/replikateur/dist/replikateur.embed.js"></script>
<script>
  const terminal = window.Replikateur.init({
    target: '#terminal',
    commands: {
      hello: {
        handle: () => 'Hello to you too :)',
        help: { example: 'hello', description: 'Say hello' },
      },
    },
  })
</script>
```

`target` is a selector or a DOM node. Everything else is the props of
`<Terminal>`, the same ones the rest of this readme describes.

`init` returns a handle:

| Method             | What it does                                     |
| ------------------ | ------------------------------------------------ |
| `update(newProps)` | Renders again with new props, keeps the terminal |
| `unmount()`        | Removes the terminal from the page               |

Calling `init` twice on the same element does not build a second terminal. It
reuses the first one and renders it with the new props, the same as `update`.

People who prefer to host the file themselves can download it from the CDN
link, or take `node_modules/replikateur/dist/replikateur.embed.js` after `npm install
replikateur`.

## Writing commands

Everything here is code you write. What the terminal does on its own is in
[Behaviour](#behaviour).

### What a command is

A command is a name and a `handle` function. What that function returns is what
the terminal prints.

```js
const commands = {
  // A response can be a string...
  hello: { handle: () => 'Hello to you too :)' },

  // ...or JSX...
  logo: { handle: () => <img src="/logo.png" alt="" /> },

  // ...or nothing at all.
  ping: { handle: () => {} },

  // Without help, a command still works but stays out of "help".
  yolo: { handle: () => 'YOLO' },

  // With help, "help" lists it as: add --name John - Add a person
  add: {
    handle: ({ flags }) => `Added ${flags.name}`,
    help: { example: 'add --name John', description: 'Add a person' },
  },
}
```

### Subcommands

A command name may be more than one word, so `user add` is a command of its
own, with its own flags and its own help.

```js
const commands = {
  user: { handle: () => 'Try: user add <name>' },
  'user add': {
    handle: ({ input }) => `Added ${input}`,
    help: { example: 'user add <name>', description: 'Add a user' },
  },
}
```

The longest name that matches wins, so `user add bob` runs `user add` with
`bob` behind it, while `user list` runs `user` with `list` behind it. Watch out
for this when a command already reads its own first word: adding `user add`
later takes that word away from `user`.

The name has to come first, so `user --json add` reads as the `user` command
with a flag, the same as in any other shell.

### Command arguments

A command handler receives one object. What is in it depends on whether the
command line uses flags.

Without flags, everything behind the command name is one string. Use `input`
when the value is a single thing that may contain spaces, and `args` when the
words are separate values.

With flags, a flag is the separator: every word after a flag belongs to that
flag, until the next flag or the end of the line. That is why `--city New York`
works without quotes.

| Command line                          | `input`        | `args`              | `flags`                                  |
| ------------------------------------- | -------------- | ------------------- | ---------------------------------------- |
| `go north east`                       | `'north east'` | `['north', 'east']` | `{}`                                     |
| `sum 10 20 5`                         | `'10 20 5'`    | `['10', '20', '5']` | `{}`                                     |
| `deploy staging --force`              | `'staging'`    | `['staging']`       | `{ force: true }`                        |
| `deploy -f`                           | `''`           | `[]`                | `{ f: true }`                            |
| `add --name John Doe --city New York` | `''`           | `[]`                | `{ name: 'John Doe', city: 'New York' }` |

```js
const commands = {
  go: { handle: ({ input }) => `OK, let's go ${input}` },
  sum: { handle: ({ args }) => args.reduce((a, b) => a + Number(b), 0) },
  deploy: { handle: ({ input, flags }) => `${input}${flags.force ? '!' : ''}` },
}
```

There is a fifth field, `rawInput`, which is the whole line exactly as typed,
command name included.

Good to know:

- A flag with no words behind it is `true`, so a flag value is
  `string | boolean`.
- A flag name is the token without its dashes. `--name` and `-n` become `name`
  and `n`, and they are not linked to each other.
- The same flag twice: the last value wins.
- A token only counts as a flag when a letter follows the dashes, so
  `sum -5 10` still works.
- `input` joins words with a single space, so runs of whitespace collapse. Use
  `rawInput` if you need the original.
- `--name=John` works too, and so does `-n=John`. Only the first `=` counts, so
  `--filter=a=b` keeps `a=b` as the value.

### Declaring flags

Say nothing and any flag is accepted. Declare them and you get short forms,
descriptions in `help`, and an error on a typo.

```js
const commands = {
  add: {
    flags: {
      name: { description: 'The name' }, // -n, automatic
      number: { short: 'u' }, // -n is taken, so pick another letter
      city: {}, // -c, no description
    },
    handle: ({ flags }) => `Added ${flags.name}`,
    help: { example: 'add --name John', description: 'Add a person' },
  },
}
```

Short forms are the first letter of the name. An explicit `short` always wins,
so the flag that would have taken that letter quietly goes without one.

Once a command declares flags, the dashes mean something:

| Typed          | Result                     |
| -------------- | -------------------------- |
| `add --name J` | ✓                          |
| `add -n J`     | ✓, arrives as `flags.name` |
| `add --n J`    | ✗ `Unknown flag: --n`      |
| `add -name J`  | ✗ `Unknown flag: -name`    |

Keys are always the long name, so `-n John` arrives as `{ name: 'John' }`.

An unknown flag stops the command:

```
> add --nmae John
Unknown flag: --nmae
Available flags: --name (-n), --city (-c)
```

Declaring flags does not type them. `flags.name` is still `string | boolean`.

Two flags cannot share one short form. See
[Mistakes reported in the terminal](#mistakes-reported-in-the-terminal).

### Async commands

Return a promise and the terminal shows an animated marker until it settles.
Everything already on screen stays where it is, and you can keep typing.

```js
const commands = {
  users: {
    handle: async () => {
      const response = await fetch('/api/users')
      const users = await response.json()

      return `${users.length} users found`
    },
  },
}
```

### Failing

A command fails by throwing, and succeeds by returning. That is the only
contract, and it is the same for sync and async handlers.

```js
const commands = {
  users: {
    handle: async () => {
      const response = await fetch('/api/users')

      if (!response.ok) throw new Error('Could not reach the server')

      return `${(await response.json()).length} users found`
    },
  },
}
```

The message lands in the history, and the terminal stays usable.

```
> users
Error: Could not reach the server
```

There are no exit codes. Nothing reads them here, so returning text is enough
when you just want to say something went wrong without it being a failure.

### Screens

A command can put something else in the terminal for a while. The history and the
prompt step aside, and closing brings them back exactly as they were. This is the
alternate screen a real terminal switches to for `vim` or `less`.

Every handler gets a `screen` with `open` and `close`. You decide how your
component gets its way out, so it stays a plain React component that knows nothing
about Replikateur.

```jsx
const commands = {
  edit: {
    handle: ({ screen }) => screen.open(<Editor onExit={screen.close} />),
  },
}
```

Replikateur only owns the screen itself: it fills the terminal, so your component
inherits the font and the colours, and the prompt is not rendered, so it cannot
take the keys or the focus your component is waiting for. Everything inside is
yours. Replikateur does not care whether it is a text interface, a form or a game.

While a screen is open, Replikateur listens for nothing, not even Ctrl+C. If what you
render has no way out, you are stuck, the same as in a real terminal.

Call `preventDefault` on the keys your screen handles. Replikateur cannot know which
ones you used, so without it the browser still acts on them: the arrows scroll the
page, and the key that closes the screen is typed into the prompt that comes back
underneath it.

A few smaller things:

- Only one screen at a time. Opening another one replaces it, and closing always
  lands you back at the prompt.
- `open` returns nothing, so the line gets no response. The command is still
  echoed, so after closing you see `> edit` above where you left off.
- A handler may open a screen _and_ return something. The response waits for you
  in the history.
- An async handler can open a screen once it resolves.
- `close` with no screen open does nothing.

### Programs you stay in

`commands` and [`prompt`](#prompt-and-welcome) are props, so a REPL needs
nothing from the library.
Swap both and everything else keeps working: only the inner commands exist,
`help` lists only those, and the history keeps the prompt each line was typed
at.

```jsx
const App = () => {
  const [inOompa, setInOompa] = useState(false)

  return (
    <Terminal
      commands={inOompa ? oompaCommands : shellCommands}
      prompt={inOompa ? 'oompa>' : '>'}
    />
  )
}
```

```
> oompa
You are in the chocolate factory. Type "exit" to leave.
oompa> sing
♪ Oompa loompa doompety doo ♫
oompa> exit
>
```

## Behaviour

You do not configure any of this. It is what the terminal gives the people who
type in it.

### One at a time

Only one command runs at a time. While one is running you can keep typing, but
Enter does nothing and the prompt keeps what you typed. When the command comes
back, your line is still sitting there and Enter works again.

This is not what a shell does, since a shell buffers your line and runs it when
the prompt returns. Keeping the text on the prompt makes it visible that it has
not run yet.

### History

Arrow up walks back through the commands you typed, and arrow down walks forward
again. If the line is empty you get the whole history.

If you already typed something, the arrows only walk through the commands that
start with it. So after `help`, `clear` and `hello`, typing `he` and pressing
arrow up gives you `hello`, then `help`, and never `clear`. The filter is what
you typed before the first arrow up, and it stays the same while you keep
walking. Arrow down past the newest match puts your own text back. Typing
anything else starts a new search.

### Ctrl+C

Ctrl+C gives up on the running command. That line becomes `Cancelled`, and a result
that arrives afterwards is ignored.

```
> wait 5
Cancelled
```

With nothing running it abandons what you typed instead, leaving a `^C` line
behind so you can see it happened. That line is not recalled by the arrow keys,
the same way a shell does not store it.

```
> half typed^C
>
```

Two more details:

- It leaves the prompt alone while a command is running, because what is typed
  there was typed while waiting for that command.
- It only interrupts when nothing is selected, so copying from the terminal
  still works.

## Appearance

### Styling

Import `replikateur/style.css` and you are done. The look is settable through props
only: [Cursor](#cursor), [Theme](#theme) and [Size](#size). The stylesheet
itself is internal, so no class names are part of the API and nothing in it is
yours to override.

What you render is still yours. A command's response and a screen are
`ReactNode`, so anything you put in there you style yourself, the normal way.

### Prompt and welcome

Both are optional strings. The prompt replaces the default `>`, on the line you
type and on every line in the history. The welcome message sits above the
prompt, and `clear` removes it along with everything else.

```jsx
<Terminal
  commands={commands}
  prompt="bouwe@replikateur $"
  welcome={'Welcome to Replikateur.\nType "help" to see what it can do.'}
/>
```

```
Welcome to Replikateur.
Type "help" to see what it can do.

bouwe@replikateur $ hello
Hello to you too :)
bouwe@replikateur $
```

### Cursor

The cursor is the browser's own text caret, and the optional `cursor` prop
changes how it looks. Both of its properties are optional: `shape` is `'bar'`
(the default thin line), `'block'` (a box over the character the caret sits on)
or `'underscore'`, and `blink` is `true` by default, so `false` makes the cursor
stand still.

```jsx
<Terminal commands={commands} cursor={{ shape: 'block', blink: false }} />
```

Both lean on the CSS properties `caret-shape` and `caret-animation`, which only
Chromium browsers support today. In Firefox and Safari you get their normal thin
blinking caret instead, and `cursor` does nothing until those browsers ship the
properties. Nothing breaks either way.

There is no `color` in there, because the theme covers it: the cursor takes the
`foreground` colour.

### Theme

The colours, the font and the padding are one optional `theme` prop. Every key
is optional, and every value is a CSS value passed straight through, so any
unit or colour notation works. Leave a key out and you get the default.

```jsx
<Terminal
  commands={commands}
  theme={{
    background: '#001b1b',
    foreground: '#e8e8e8',
    promptColor: 'cyan',
    responseColor: 'rgb(180 180 180)',
    fontFamily: '"Fira Code", monospace',
    fontSize: '1.1rem',
    padding: '2em',
  }}
/>
```

| Key             | What it colours or sets                        | Default                                       |
| --------------- | ---------------------------------------------- | --------------------------------------------- |
| `background`    | The whole terminal                             | `black`                                       |
| `foreground`    | What you type, in the history too, and help    | `white`                                       |
| `promptColor`   | The prompt, and the example commands in `help` | `#00ff00`                                     |
| `responseColor` | What a command answered                        | `#cccccc`                                     |
| `fontFamily`    | Everything, the input included                 | `'Menlo', 'Monaco', 'Courier New', monospace` |
| `fontSize`      | Everything, the input included                 | `14px`                                        |
| `padding`       | The space around the whole terminal            | `20px`                                        |

### Size

By default the terminal fills the viewport: the full width of its parent and
`100vh` tall. Pass `size` to put it in a box on a page instead. Both keys are
optional and take any CSS length.

```jsx
<Terminal commands={commands} size={{ width: '600px', height: '400px' }} />
```

The box scrolls, not the page, so a long history stays inside it either way.

## Troubleshooting

Mistakes in your own command definitions, not the errors a command throws. Those
are in [Failing](#failing).

### Mistakes reported in the console

Some mistakes leave a command quietly unreachable, so the terminal checks for
them and reports them with `console.error` when it renders:

- A command name that is empty, has a word starting with a dash, or is not
  spaced with single spaces. None of these can ever be typed.
- A command without a `handle` function.
- A flag name that is empty, starts with a dash, or contains a space or an `=`.
- A `short` that is not a single letter.

### Mistakes reported in the terminal

Two flags cannot share one short form, so the command refuses to run until you
fix it. Set `short` on one of them.

When both flags declared the same letter, the message names it:

```
> add
replikateur: --name and --number both use -n. A short form belongs to one flag.
```

When they only collide because they start with the same letter, neither gets a
short form:

```
> add
replikateur: --name and --number both want -n. Neither gets a short form. Set `short` on one.
```

## Development

The Node version is pinned in `.tool-versions`, for asdf or mise.

Install the dependencies once:

```bash
npm install
```

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

| File         | What it is                       |
| ------------ | -------------------------------- |
| `replikateur.js`   | The library, ES module           |
| `replikateur.css`  | The styles, must be imported too |
| `replikateur.d.ts` | The TypeScript types             |

React is not bundled. It is a peer dependency, so the app that uses the library
brings its own copy.

### Build the embed script

```bash
npm run build:embed
```

This builds `dist/replikateur.embed.js`, the single file from [Without a build
step](#without-a-build-step). It has its own Vite config,
`vite.embed.config.ts`, because the rules are the opposite of the library ones:
React is bundled, the styles are injected into the page by the script itself,
and the output is one file that runs in a browser as it is.

It writes into the same `dist`, so run it after `npm run build`, not before:
`npm run build` empties `dist` first.

### The demo app

The demo app lives in `demo` and runs against `dist`, so what you try out is
what people actually get when they install the library.

```bash
./dev.sh   # or npm run dev, the same thing
```

That builds the library and the embed script, and starts the app on
http://localhost:5173. There are two pages, and they link to each other:

| Page          | What it is                                                  |
| ------------- | ----------------------------------------------------------- |
| `/`           | A React app, with a panel to change every prop live          |
| `/embed.html` | A plain page with one `<script>` tag and `window.Replikateur.init` |

Try `help`, `clear`, and the commands in `demo/commands.jsx`. The two pages do
not share their commands: the React ones return JSX, which needs the app's own
React, while the embed page has no React of its own. Its commands are plain
strings, the same as a real embedder writes.

Check the page that matches what you changed. Both, if you touched the build.

The app has no dependencies of its own. Vite, React and the React plugin are
resolved from the `node_modules` of this repo, so there is nothing to install and
there is only one copy of React.

Because it uses the build and not the source, `npm run dev` builds first, and you
run it again after every library change. There is no HMR against the source: that
needs a second demo app, and keeping two of them in step turned out to cost more
than the rebuild does.

### Publish to npm

```bash
./publish.sh patch   # or minor, or major
```

This installs, bumps the version, builds, publishes to npm and pushes the tag.

The embed script is built too. `npm publish` runs the `prepublishOnly` script
first, which is `npm run build:embed`, and `dist` is what the package ships. So
every published version has `dist/replikateur.embed.js` in it, and every published
version has a CDN link.
