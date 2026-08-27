// The public interface of the library. Everything else in ./terminal is internal.
export { Terminal } from './terminal'

export type {
  TerminalProps,
  TerminalClasses,
  TerminalScreen,
  TerminalCursor,
  CursorShape,
  Commands,
  CommandDefinition,
  CommandHandler,
  CommandHandlerArgs,
  CommandResponse,
  CommandHelp,
  CommandFlags,
  CommandFlagDefinition,
  CommandFlagDefinitions,
} from './terminal'
