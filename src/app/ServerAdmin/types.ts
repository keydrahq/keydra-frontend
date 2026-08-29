/** Wire types for server administration, mirroring io.keydra.engine. */

export interface ServerSetting {
  name: string;
  value: string;
  /** Whether it holds nothing, which for many settings is what "off" looks like. */
  isUnset: boolean;
}

export interface PersistenceState {
  snapshotEnabled: boolean;
  logEnabled: boolean;
  /** When the last snapshot succeeded, in seconds since the epoch. */
  lastSaveSeconds: number;
  lastSaveFailed: boolean;
  /** Writes since the last snapshot: what would be lost if the server stopped now. */
  changesSinceSave: number;
  inProgress: boolean;
  /**
   * Where the server writes its snapshot, on the server's own filesystem.
   *
   * <p>Which for a containerised server is inside that container. Null when the server declines
   * to answer CONFIG GET.
   */
  snapshotFile: string | null;
}
