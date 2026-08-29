import { shapeFrom, shapeToRequest } from '@app/KeyBrowser/MigrationShaping';
import { JobType } from './types';
import type { JobSettings } from './types';

/**
 * A schedule's own settings, which every job type reads differently.
 *
 * <p>JSON in one column rather than a column per field, because the three kinds of work have almost
 * nothing in common. This is the small amount of care that costs: the shape is read here, written
 * here, and validated by the handler that will run it.
 */
export const parseSettings = (json: string | null | undefined): JobSettings => {
  if (!json) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? (parsed as JobSettings) : {};
  } catch {
    // A row nobody can read is still a row somebody has to be able to edit, so an
    // unreadable one opens as empty rather than as a blank screen.
    return {};
  }
};

/** Only the fields this kind of work reads, so a type change does not leave the last one's behind. */
export const serialiseSettings = (jobType: JobType, settings: JobSettings): string => {
  const match = settings.match?.trim() || '*';
  switch (jobType) {
    case JobType.FlushDatabase:
      return JSON.stringify(
        settings.database === undefined ? { match } : { match, database: settings.database },
      );
    case JobType.CopyKeys:
      return JSON.stringify({
        targetConnectionId: settings.targetConnectionId,
        match,
        replace: settings.replace ?? true,
        deleteFromSource: settings.deleteFromSource ?? false,
        // The shaping, and only the parts of it that were answered: an unset field is left out
        // rather than written as an empty string, because the handler reads "absent" as "do not
        // shape" and would read "" as a prefix of no characters.
        ...shapeToRequest(shapeFrom(settings)),
      });
    default:
      return JSON.stringify({
        destinationId: settings.destinationId,
        match,
        filePrefix: settings.filePrefix?.trim() || undefined,
        keepLast: settings.keepLast && settings.keepLast > 0 ? settings.keepLast : undefined,
      });
  }
};

/** Whether the form holds enough for this kind of work; the backend asks the same questions. */
export const settingsAreComplete = (jobType: JobType, settings: JobSettings): boolean => {
  if (jobType === JobType.CopyKeys) {
    return settings.targetConnectionId !== undefined;
  }
  if (jobType === JobType.ExportKeys) {
    const prefix = settings.filePrefix ?? '';
    // A backup job with nowhere to send the backup is the one misconfiguration that looks
    // like it worked, so it is refused here as well as by the server.
    return (
      settings.destinationId !== undefined &&
      // The prefix becomes a file name, and a name is not a way to write outside where the
      // destination points.
      !/[/\\]|\.\./.test(prefix)
    );
  }
  return true;
};
