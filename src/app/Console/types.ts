/** Wire types for the console, mirroring io.keydra.console.dto and io.keydra.engine. */

/**
 * A command's reply.
 *
 * <p>Discriminated on `kind`, mirroring the backend's sealed ConsoleValue: a renderer that forgets
 * a shape is a compile error rather than a blank line in the transcript.
 */
export type ConsoleValue =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'decimal'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'error'; message: string }
  | { kind: 'nil' }
  | { kind: 'sequence'; items: ConsoleValue[] };

export interface ConsoleCommand {
  id: string;
  line: string;
}

export interface ConsoleResult {
  id: string;
  line: string;
  value: ConsoleValue;
  durationMs: number;
}

export interface HistoryEntry {
  id: number;
  line: string;
  executedAt: string;
}

/** A line in the transcript: what was typed, and what came back once it has. */
export interface TranscriptEntry {
  id: string;
  line: string;
  result?: ConsoleResult;
}

/**
 * One command a target can be allowed to run, and what allowing it means.
 *
 * <p>The reason travels with the command because it is the decision. A form that listed names
 * would be asking somebody to allow MODULE without saying that MODULE runs code inside the server,
 * which is the whole of what they are being asked.
 *
 * <p>A stable key rather than the sentence — `runs-code`, `writes-a-file`. `describeConsoleReason`
 * turns it into the sentence, in the language the page was asked for.
 */
export interface AskableCommand {
  command: string;
  reason: string;
}
