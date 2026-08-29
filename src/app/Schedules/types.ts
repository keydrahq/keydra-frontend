/** Mirrors io.keydra.schedule.entity.JobType. */
export const JobType = {
  FlushDatabase: 'FLUSH_DATABASE',
  CopyKeys: 'COPY_KEYS',
  ExportKeys: 'EXPORT_KEYS',
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

/** Mirrors io.keydra.schedule.entity.RunOutcome. */
export const RunOutcome = {
  Running: 'RUNNING',
  Done: 'DONE',
  Failed: 'FAILED',
  Refused: 'REFUSED',
  /** The instance running it went away, and whichever took on the chores wrote it down. */
  Interrupted: 'INTERRUPTED',
} as const;

export type RunOutcome = (typeof RunOutcome)[keyof typeof RunOutcome];

/** A schedule as the list shows it. */
export interface ScheduleSummary {
  id: number;
  name: string;
  connectionId: number;
  /** Carried beside the id: a schedule's name means nothing without knowing which server. */
  connectionName: string | null;
  jobType: JobType;
  cron: string;
  enabled: boolean;
  /** What this kind of work needs, as JSON. Read by its own form and by nothing else. */
  settings: string | null;
  createdBy: string | null;
  createdAt: string;
  lastRunAt: string | null;
  lastOutcome: RunOutcome | null;
  nextRunAt: string | null;
}

/** A schedule to create or change. */
export interface ScheduleRequest {
  name: string;
  connectionId: number;
  jobType: JobType;
  cron: string;
  enabled?: boolean;
  settings?: string;
  /** The target's name, where a schedule that would empty it asks to be named. */
  confirmTarget?: string;
  /**
   * The far end's own name, when a copy would write into a guarded server.
   *
   * <p>Two names rather than one, because a copy is two servers and one name cannot say which was
   * meant. The job supplies both itself when it fires, so this is the only moment a person is
   * asked at all.
   */
  confirmSecond?: string;
}

/** One attempt, and what it did. */
export interface JobRunSummary {
  id: number;
  jobId: number;
  jobName: string | null;
  startedAt: string;
  finishedAt: string | null;
  outcome: RunOutcome;
  detail: string | null;
  wasManual: boolean;
}

/** One kind of work, with the permission it needs on the target. */
export interface JobTypeInfo {
  name: JobType;
  requires: string;
}

/** What a schedule's JSON settings hold, across all three job types. */
export interface JobSettings {
  /** Which keys the work is about. `*` means all of them. */
  match?: string;
  /** FLUSH_DATABASE: which database, or absent for the connection's own. */
  database?: number;
  /** COPY_KEYS: where the keys go. */
  targetConnectionId?: number;
  /** COPY_KEYS: overwrite a key that is already there. */
  replace?: boolean;
  /** COPY_KEYS: remove each key from the source once it has arrived. */
  deleteFromSource?: boolean;
  /*
   * COPY_KEYS: the same shaping a migration started by hand can ask for. A copy that runs at three
   * in the morning is the one that most wants a ceiling and the one nobody is watching to notice
   * it did not have one.
   */
  /** COPY_KEYS: only keys of this type, narrowed while the keyspace is walked. */
  type?: string;
  /** COPY_KEYS: a prefix taken off each name as it is written. */
  stripPrefix?: string;
  /** COPY_KEYS: a prefix put on each name as it is written. */
  addPrefix?: string;
  /** COPY_KEYS: Lua deciding each key, which needs script:run at every firing. */
  script?: string;
  /** COPY_KEYS: a ceiling on the walk, in keys per second. */
  maxKeysPerSecond?: number;
  /** EXPORT_KEYS: the start of the file name; the run stamps the rest. */
  filePrefix?: string;
  /** EXPORT_KEYS: where the backup goes. */
  destinationId?: number;
  /** EXPORT_KEYS: how many of this prefix's backups to leave behind. */
  keepLast?: number;
}
