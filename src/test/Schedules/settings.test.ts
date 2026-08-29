import { describe, expect, it } from 'vitest';
import { parseSettings, serialiseSettings, settingsAreComplete } from '@app/Schedules/settings';
import { JobType } from '@app/Schedules/types';

describe('parseSettings', () => {
  it('reads what a schedule carries', () => {
    expect(parseSettings('{"match":"session:*","database":3}')).toEqual({
      match: 'session:*',
      database: 3,
    });
  });

  it.each([[null], [undefined], [''], ['not json'], ['"a string"'], ['null']])(
    'opens %s as empty rather than as a blank screen',
    (stored) => {
      expect(parseSettings(stored)).toEqual({});
    },
  );
});

describe('serialiseSettings', () => {
  it('writes only the fields the chosen kind of work reads', () => {
    // The whole reason changing the kind clears the form: a copy's destination sent along
    // with a flush would be ignored until somebody read the row and wondered.
    const written = JSON.parse(
      serialiseSettings(JobType.FlushDatabase, { match: 'a:*', targetConnectionId: 7 }),
    );

    expect(written).toEqual({ match: 'a:*' });
  });

  it('defaults an empty pattern to everything, which is what cron scripts mean', () => {
    expect(
      JSON.parse(serialiseSettings(JobType.ExportKeys, { match: '  ', destinationId: 3 })),
    ).toEqual({ match: '*', destinationId: 3 });
  });

  it('leaves an unnamed backup unnamed, so the server uses the target’s own name', () => {
    // Rather than writing "export" into the row: two targets backed up to the same place
    // would then share a file name, and the retention of one would prune the other's.
    const written = JSON.parse(
      serialiseSettings(JobType.ExportKeys, { destinationId: 3, filePrefix: '  ' }),
    );

    expect(written.filePrefix).toBeUndefined();
  });

  it('drops a retention of zero, which means keep everything', () => {
    const written = JSON.parse(
      serialiseSettings(JobType.ExportKeys, { destinationId: 3, keepLast: 0 }),
    );

    expect(written.keepLast).toBeUndefined();
  });

  it('keeps a copy’s answers to the two questions it must answer', () => {
    expect(
      JSON.parse(serialiseSettings(JobType.CopyKeys, { targetConnectionId: 4, match: '*' })),
    ).toEqual({ targetConnectionId: 4, match: '*', replace: true, deleteFromSource: false });
  });

  it('omits a database nobody chose, so the connection’s own is used', () => {
    expect(JSON.parse(serialiseSettings(JobType.FlushDatabase, {}))).toEqual({ match: '*' });
  });
});

describe('settingsAreComplete', () => {
  it('wants a destination before a copy can be arranged', () => {
    expect(settingsAreComplete(JobType.CopyKeys, {})).toBe(false);
    expect(settingsAreComplete(JobType.CopyKeys, { targetConnectionId: 2 })).toBe(true);
  });

  it.each([['../etc/passwd'], ['a/b'], ['a\\b']])(
    'refuses %s as a file name, the same rule the server applies',
    (filePrefix) => {
      expect(settingsAreComplete(JobType.ExportKeys, { destinationId: 3, filePrefix })).toBe(false);
    },
  );

  it('wants somewhere for the backup to go', () => {
    // A backup job with nowhere to send the backup is the one misconfiguration that looks
    // like it worked.
    expect(settingsAreComplete(JobType.ExportKeys, {})).toBe(false);
    expect(settingsAreComplete(JobType.ExportKeys, { destinationId: 3 })).toBe(true);
  });

  it('asks nothing extra of a flush', () => {
    expect(settingsAreComplete(JobType.FlushDatabase, {})).toBe(true);
  });
});
