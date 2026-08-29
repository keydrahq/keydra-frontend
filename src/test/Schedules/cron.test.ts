import { describe, expect, it } from 'vitest';
import { defaultCadence, fromCron, isRecognised, toCron } from '@app/Schedules/cron';
import type { Cadence } from '@app/Schedules/cron';

const cadence = (over: Partial<Cadence>): Cadence => ({ ...defaultCadence, ...over });

describe('toCron', () => {
  it.each([
    ['minutes', cadence({ every: 'minutes', interval: 15 }), '*/15 * * * *'],
    ['hourly', cadence({ every: 'hourly', minute: 30 }), '30 * * * *'],
    ['daily', cadence({ every: 'daily', time: '03:00' }), '0 3 * * *'],
    ['weekly', cadence({ every: 'weekly', time: '02:15', weekday: 1 }), '15 2 * * 1'],
    ['monthly', cadence({ every: 'monthly', time: '04:05', day: 12 }), '5 4 12 * *'],
  ])('writes a %s cadence as a crontab line', (_name, given, expected) => {
    expect(toCron(given)).toBe(expected);
  });

  it('carries a custom expression through untouched', () => {
    // The point of the escape hatch: a line somebody pasted is never rewritten into
    // something the form finds easier to draw.
    expect(toCron(cadence({ every: 'custom', expression: '0 0 1 1 *' }))).toBe('0 0 1 1 *');
  });

  it.each([
    [cadence({ every: 'minutes', interval: 0 }), '*/1 * * * *'],
    [cadence({ every: 'minutes', interval: 99 }), '*/59 * * * *'],
    [cadence({ every: 'monthly', day: 31, time: '00:00' }), '0 0 28 * *'],
  ])('keeps a value the picker cannot produce inside cron’s range', (given, expected) => {
    expect(toCron(given)).toBe(expected);
  });
});

describe('fromCron', () => {
  it.each([
    ['*/5 * * * *', 'minutes'],
    ['0 * * * *', 'hourly'],
    ['0 3 * * *', 'daily'],
    ['30 2 * * 1', 'weekly'],
    ['0 4 12 * *', 'monthly'],
  ])('reads %s back as a %s cadence', (expression, every) => {
    expect(fromCron(expression).every).toBe(every);
  });

  it('round-trips every shape the picker can produce', () => {
    const shapes = [
      cadence({ every: 'minutes', interval: 5 }),
      cadence({ every: 'hourly', minute: 45 }),
      cadence({ every: 'daily', time: '23:59' }),
      cadence({ every: 'weekly', time: '06:30', weekday: 0 }),
      cadence({ every: 'monthly', time: '01:00', day: 28 }),
    ];

    shapes.forEach((shape) => {
      expect(toCron(fromCron(toCron(shape)))).toBe(toCron(shape));
    });
  });

  it.each([
    // Not five fields.
    ['0 3 * *'],
    ['0 0 3 * * *'],
    // A month, which no picker control can express.
    ['0 3 * 6 *'],
    // Both a day of the month and a day of the week.
    ['0 3 1 * 1'],
    // Step syntax outside the minutes field.
    ['0 */2 * * *'],
    // Nothing at all.
    [''],
  ])('answers custom for %s rather than guessing', (expression) => {
    const read = fromCron(expression);

    expect(read.every).toBe('custom');
    expect(read.expression).toBe(expression);
    expect(isRecognised(expression)).toBe(false);
  });

  it('answers custom for an expression that is not there', () => {
    expect(fromCron(undefined).every).toBe('custom');
  });
});
