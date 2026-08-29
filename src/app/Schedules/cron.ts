/**
 * Turning a cadence somebody picked into the crontab line the scheduler reads, and back.
 *
 * <p>The backend speaks ordinary five-field crontab syntax, which is the point — a schedule moved
 * into Keydra should be the same line it was in somebody's crontab. That is also why the raw
 * expression stays available: the five shapes below cover what people actually schedule, and the
 * sixth option is for everybody they do not cover, rather than a wall this form puts up.
 */

export type Every = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Cadence {
  every: Every;
  /** `minutes`: how many between runs. */
  interval: number;
  /** `hourly`: which minute past the hour. */
  minute: number;
  /** `daily`, `weekly`, `monthly`: the time of day, as HH:MM. */
  time: string;
  /** `weekly`: 0 is Sunday, matching cron. */
  weekday: number;
  /** `monthly`: which day of the month. */
  day: number;
  /** `custom`: the expression as written. */
  expression: string;
}

export const defaultCadence: Cadence = {
  every: 'daily',
  interval: 15,
  minute: 0,
  time: '03:00',
  weekday: 1,
  day: 1,
  // Not empty: somebody who switches to custom should see a working line to edit rather
  // than a blank field and a refusal.
  expression: '0 3 * * *',
};

const clamp = (value: number, low: number, high: number): number =>
  Number.isFinite(value) ? Math.min(high, Math.max(low, Math.trunc(value))) : low;

const splitTime = (time: string): [number, number] => {
  const [hour, minute] = time.split(':');
  return [clamp(Number(hour), 0, 23), clamp(Number(minute), 0, 59)];
};

/** The crontab line a cadence means. */
export const toCron = (cadence: Cadence): string => {
  const [hour, minute] = splitTime(cadence.time);
  switch (cadence.every) {
    case 'minutes':
      return `*/${clamp(cadence.interval, 1, 59)} * * * *`;
    case 'hourly':
      return `${clamp(cadence.minute, 0, 59)} * * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${clamp(cadence.weekday, 0, 6)}`;
    case 'monthly':
      return `${minute} ${hour} ${clamp(cadence.day, 1, 28)} * *`;
    default:
      return cadence.expression.trim();
  }
};

const time = (hour: string, minute: string): string =>
  `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

/**
 * The cadence an expression came from, so editing a schedule opens on the control that made it.
 *
 * <p>Anything this cannot recognise comes back as `custom` carrying the expression verbatim. That
 * is the honest answer for a line somebody pasted, and it means a schedule is never silently
 * rewritten into something the form finds easier to draw.
 */
export const fromCron = (expression: string | undefined): Cadence => {
  const fields = (expression ?? '').trim().split(/\s+/);
  const custom: Cadence = { ...defaultCadence, every: 'custom', expression: expression ?? '' };
  if (fields.length !== 5) {
    return custom;
  }
  const [minute, hour, day, month, weekday] = fields;
  if (month !== '*') {
    return custom;
  }

  const everyN = /^\*\/(\d{1,2})$/.exec(minute);
  if (everyN && hour === '*' && day === '*' && weekday === '*') {
    return { ...defaultCadence, every: 'minutes', interval: Number(everyN[1]) };
  }
  if (!/^\d{1,2}$/.test(minute)) {
    return custom;
  }
  if (hour === '*' && day === '*' && weekday === '*') {
    return { ...defaultCadence, every: 'hourly', minute: Number(minute) };
  }
  if (!/^\d{1,2}$/.test(hour)) {
    return custom;
  }
  if (day === '*' && weekday === '*') {
    return { ...defaultCadence, every: 'daily', time: time(hour, minute) };
  }
  if (day === '*' && /^[0-6]$/.test(weekday)) {
    return {
      ...defaultCadence,
      every: 'weekly',
      time: time(hour, minute),
      weekday: Number(weekday),
    };
  }
  if (weekday === '*' && /^\d{1,2}$/.test(day)) {
    return { ...defaultCadence, every: 'monthly', time: time(hour, minute), day: Number(day) };
  }
  return custom;
};

/** Whether an expression is one this form can draw, as opposed to one it can only carry. */
export const isRecognised = (expression: string): boolean =>
  fromCron(expression).every !== 'custom';
