import type { GraphQLService } from '@app/Shared/Services/GraphQL.service';
import type { AskableCommand, HistoryEntry } from './types';

const HISTORY = `
  query ConsoleHistory($connectionId: BigInteger) {
    consoleHistory(connectionId: $connectionId) {
      id
      line
      executedAt
    }
  }
`;

const CLEAR = `
  mutation ClearConsoleHistory($connectionId: BigInteger) {
    clearConsoleHistory(connectionId: $connectionId)
  }
`;

const DENIED = `
  query DeniedCommands($connectionId: BigInteger) {
    deniedCommands(connectionId: $connectionId)
  }
`;

const ASKABLE = `
  query AskableCommands {
    askableCommands {
      command
      reason
    }
  }
`;

/** Everything about a console session that is not the session itself. */
export const consoleApi = {
  history: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ consoleHistory: HistoryEntry[] }>(HISTORY, { connectionId })
      .then((a) => a.consoleHistory),

  clearHistory: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ clearConsoleHistory: boolean }>(CLEAR, { connectionId })
      .then((a) => a.clearConsoleHistory),

  deniedCommands: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ deniedCommands: string[] }>(DENIED, { connectionId })
      .then((a) => a.deniedCommands),

  /**
   * The commands a target can be allowed, which is what the connection form offers.
   *
   * <p>Asked of the server rather than written out here. The list is the other half of the
   * deny-list, it is decided in one place, and a copy in the browser would be a second place to
   * forget when a command moves between the halves.
   */
  askableCommands: (graphql: GraphQLService) =>
    graphql
      .query<{ askableCommands: AskableCommand[] }>(ASKABLE, {})
      .then((a) => a.askableCommands),
};
