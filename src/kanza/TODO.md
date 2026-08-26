# TODO / ideëen

- [x] Library name: "kanza", publish op NPM, TypeScript, CSS
- [x] Clear commando moet echt alles clearen incl. clear commando zelf...
- [x] Geen regex meer
- [x] args als string array in handle function
- [ ] --args en -A ook ondersteunen, of in ieder geval een helper?
- [ ] Programma's maken waar je in blijft?
- [ ] TUIs? 😱
- [ ] Validatie op commands? Ik heb met TS al aangegeven dat spaties niet zijn toegestaan, maar runtime is er vast van alles te checken in mijn huidige code...
- [ ] Alles overhevelen naar kanza en react-terminal repo verwijderen.
- [ ] Constructie om snel een dev build appje op te tuigen, net als met Temba

---

Gemini zegt:

> Here are 5 high-value features that would take this library to the next level:
> 
> Tab Autocomplete Allow users to press the Tab key to auto-fill command names. If multiple commands match (e.g., git and give), you could cycle through them or display a list of candidates. This is a staple of every real terminal.
> 
> Asynchronous Command Support Currently, your commands return immediately. Supporting Promise<ReactNode> would allow for commands like fetch-data that simulate loading states (e.g., showing a spinner or progress bar) before displaying the final result.
> 
> Command Arguments Parsing Right now, you manually split strings by spaces. Integrating a lightweight parser (like minimist or a custom regex solution) would allow for robust flags (e.g., command --verbose -f file.txt), enabling much more complex interaction patterns.
> 
> Simulated File System (Virtual DOM) Add a context that tracks a "Current Working Directory" (CWD). This allows you to implement cd, ls, and pwd, making the terminal feel like a navigable space rather than just a chat bot.
> 
> Multi-line Input (Continuation) Allow users to write complex inputs by pressing Shift+Enter or by ending a line with a backslash \. This is useful if you ever want to support pasting code snippets or writing long JSON blobs into the terminal.