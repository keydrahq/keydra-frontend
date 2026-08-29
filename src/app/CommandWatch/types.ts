/** Wire types for the command watch, mirroring io.keydra.monitoring.dto. */

export interface CommandFrame {
  /** When the store ran it, in microseconds since the epoch. */
  atMicros: number;
  /** The database it ran against, or -1 when the store did not say. */
  database: number;
  /** Where it came from, or null for a command the store issued itself. */
  client: string | null;
  name: string;
  arguments: string[];
  /** How many commands were discarded before this one because the reader was behind. */
  dropped: number;
}

/** A frame with an identity of its own, since nothing in the frame is unique. */
export interface WatchedCommand extends CommandFrame {
  id: number;
}
