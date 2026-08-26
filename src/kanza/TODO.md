# TODO / ideëen

- [x] Library name: "kanza", publish op NPM, TypeScript, CSS
- [x] Clear commando moet echt alles clearen incl. clear commando zelf...
- [x] Geen regex meer
- [x] args als string array in handle function
- [x] --args en -A ook ondersteunen, of in ieder geval een helper?
- [x] `--name=John` ook ondersteunen, nu wordt dat een flag die `name=John` heet.
- [x] Args configureerbaar maken per command: documentatie in `help` per arg, en
      validatie op onbekende args. Optioneel houden, anders breekt het bestaande commands.
- [x] Async commands. Nu al kapot in plaats van geblokkeerd: `handle: async () => ...`
      typecheckt gewoon, want `ReactNode` van React 19 bevat `Promise<AwaitedReactNode>`.
      Getest met een promise van 50ms: direct na Enter is de hele `role="log"` leeg (`""`),
      dus ook alle eerdere output, en pas na het resolven staat er `"> slowdone"`. Er is
      geen Suspense boundary in `Terminal`, dus React suspendt het hele log. React logt
      ook een waarschuwing over een suspended resource.
      Gebouwd: history item wordt meteen gepusht met een animerende `...` marker,
      de response wordt ingevuld zodra de promise settled, een reject wordt
      `Error: <message>`. Er draait er maar een tegelijk: tijdens een command mag je
      wel typen maar doet Enter niets, en je regel blijft staan tot het command
      terug is. Ctrl+C breekt het draaiende command af (`Cancelled`) en negeert een
      resultaat dat daarna nog binnenkomt.
- [x] Eigen prompt via `prompt` prop, in plaats van de vaste `>`. Geldt ook voor de
      echo van eerdere commands in de history.
- [x] Welkomstbericht via `welcome` prop, boven de prompt. `clear` haalt hem ook weg.
- [x] Een `handle` die synchroon throwt wordt nergens opgevangen, terwijl een async
      reject netjes `Error: <message>` oplevert. Getest met `handle: () => { throw ... }`:
      er komt geen history item, het log blijft `""`, en omdat `handleFormSubmit` de
      throw niet overleeft wordt de input niet geleegd. Typ je daarna `hello`, dan staat
      er `boomhello` en krijg je `Unknown command: boomhello`.
      Opgelost met een try/catch om `handle` heen, zelfde `Error: <message>` als bij
      een reject. Geen exit codes: throwen is falen, returnen is lukken.
- [x] Ctrl+C zichtbaar maken als `^C` regel? Nu zie je alleen dat de response
      `Cancelled` wordt, en zonder draaiend command helemaal niets.
- [ ] Tab autocomplete op commandonamen. Alles is er al: de namen zijn de keys van
      `commands`, en `CommandInput` handelt ArrowUp/ArrowDown al af.
      UX-overzicht van alle gevallen en de voorgestelde scope staat in
      `tab-completion.md`. Kort: alleen commandonamen bouwen, lijst in plaats van
      cyclen, waardes (`--city <Tab>`) buiten scope tot een command het nodig heeft.
- [x] `help <command>` voor één command, nu help langer wordt door de flags per command.
- [x] BUG: de prompt in de history volgt de huidige `prompt` prop in plaats van die
      van het moment dat het command draaide. Verander je `prompt`, dan veranderen
      alle oudere regels met terugwerkende kracht mee. Prompt per history item
      vastleggen bij `pushToHistory`.
- [x] Geneste REPL: een command waarmee je een programma in gaat, waarin alleen de
      commands van dat programma bestaan, tot je `exit` doet. De terminal zelf is al
      een REPL, dit is er een binnenin, zoals `python` in bash.
      Kan nu al, zonder library changes: `commands` en `prompt` zijn props, dus de
      parent kan ze omwisselen. Getest: scoping, `help` en alles rond flags en async
      werken dan gewoon binnen de REPL. Staat nu als `oompa` in de demo app en in
      de readme.
      Wat de library zou toevoegen is verpakking, geen mogelijkheid: nu ligt het
      startcommando, de commandoset en de state bij de parent, dus je kunt geen
      losse "dit is mijn oompa REPL" waarde doorgeven. Met support kan een handler
      teruggeven "ga verder met deze commands". De prop-route moet blijven werken.
- [x] TUIs? 😱 Algemener gemaakt naar "screens": een command kan tijdelijk iets
      anders in de terminal zetten, en sluiten brengt je terug bij de prompt. Wat
      je daar rendert maakt de library niet uit, een TUI is er maar één ding van.
      De API staat in `README.md`, de afwegingen in commit f52510d.
      Gebouwd: `handle` krijgt er een `screen` bij met `open` en `close`. Staat er
      een screen open, dan renderen de history en de `CommandInput` niet. Die
      input moest weg, niet alleen verstopt: hij heeft focus en pakt anders de
      keys af van wat je rendert. De history zelf blijft gewoon staan in
      `Terminal`, dus sluiten geeft hem onaangeroerd terug, en `useFocus` van een
      opnieuw gemounte `CommandInput` zet de focus vanzelf terug op de prompt.
      Eén screen tegelijk, en Kanza luistert nergens op zolang er een openstaat,
      ook niet op Ctrl+C: dat zou een key afpakken van wat er in het screen leeft.
- [ ] Screens: vier dingen bewust open gelaten. Geen blockers, oppakken als er een
      reden voor is.
      - Scrollpositie bij terugkomen. De history verbergen betekent dat de
        scrollpositie van de container weg is, dus sluiten landt waarschijnlijk
        bovenaan de scrollback in plaats van waar je was. Alleen te merken bij een
        lange history.
      - Een screen openen buiten een command om. Nu kan alleen een handler het. Een
        app die *in* een screen wil starten kan dat niet zeggen. Een prop zou het
        doen, en past bij de geneste REPL, maar niets heeft het nodig.
      - Iets teruggeven via `close`. `close()` neemt niets aan, dus een screen dat
        een resultaat wil melden (een gekozen bestand, een ingevuld formulier) moet
        dat via je eigen state doen. Blijkt dat het normale geval, dan is
        `close(node)` dat een history-regel pusht de volgende stap.
      - Nesten. Besloten als "vervangen", maar niets kan het triggeren: alleen een
        command opent een screen, en zolang er een openstaat is er geen prompt om
        er een te typen. Terugkomen als openen buiten een command er ooit komt.
- [x] Validatie op commands? Ik heb met TS al aangegeven dat spaties niet zijn
      toegestaan, maar runtime is er vast van alles te checken in mijn huidige code...
      Runtime checks bij render (`console.error`): lege naam, spatie in de naam, naam
      met een streepje ervoor, geen `handle` functie, flagnaam die nooit getypt kan
      worden, en een `short` die geen enkele letter is. Twee flags met dezelfde short
      blokkeert het command zelf, net als een botsing tussen automatische shorts.
- [x] Alles overhevelen naar kanza en react-terminal repo verwijderen.
- [x] Constructie om snel een dev build appje op te tuigen, net als met Temba

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
