// The public interface of the library. Everything else in ./terminal is
// internal, even where it is exported there so the tests can reach it.
export { Terminal } from './terminal'

export type {
  TerminalProps,
  TerminalClasses,
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
