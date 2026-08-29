import type { InstanceSummary } from './queries';

/** What one instance is doing, per second, worked out from two readings. */
export interface BusRate {
  published: number;
  received: number;
  /** Commands sent to targets — the other half of what an instance actually does. */
  commands: number;
}

/** A reading kept so the next one can be compared with it. */
interface Reading {
  published: number;
  received: number;
  commands: number;
}

const NOTHING: BusRate = { published: 0, received: 0, commands: 0 };

/**
 * The answer before this one.
 *
 * <p>Held here rather than in a component, because working out a rate is not something a render can
 * do: it needs the previous reading, the clock, and a place to put this one — and a render may not
 * read a ref, may not call {@code Date.now()}, and may run twice. Fetching may do all three, so the
 * arithmetic happens where the answer arrives and every component above it sees a plain number.
 */
let watched: { at: number; readings: Map<string, Reading> } = { at: 0, readings: new Map() };

/**
 * Turns the counters into rates, against whatever came last.
 *
 * <p>The server sends totals and this does the subtraction, which is the right way round: a counter
 * only goes up, so it is a number nothing can disagree about, and a rate computed here is a rate
 * over exactly the interval the browser watched. A server computing it would need a clock of its
 * own and would have to guess what interval anybody wanted.
 *
 * <p>A counter that went *down* means the instance restarted — the totals live in its memory — so
 * that reading starts a new baseline rather than producing a negative rate.
 */
export const ratesSince = (instances: InstanceSummary[]): Map<string, BusRate> => {
  const now = Date.now();
  const seconds = (now - watched.at) / 1000;
  const rates = new Map<string, BusRate>();
  const readings = new Map<string, Reading>();

  for (const instance of instances) {
    const previous = watched.readings.get(instance.id);
    const reading: Reading = {
      published: instance.published,
      received: instance.received,
      commands: instance.commands,
    };
    readings.set(instance.id, reading);

    if (
      previous === undefined ||
      seconds <= 0 ||
      reading.published < previous.published ||
      reading.received < previous.received ||
      reading.commands < previous.commands
    ) {
      // No comparison to make: either this is the first sight of it, or it restarted.
      rates.set(instance.id, NOTHING);
      continue;
    }
    rates.set(instance.id, {
      published: (reading.published - previous.published) / seconds,
      received: (reading.received - previous.received) / seconds,
      commands: (reading.commands - previous.commands) / seconds,
    });
  }

  watched = { at: now, readings };
  return rates;
};

/** How a rate reads on an edge: a number nobody has to divide in their head. */
export const formatRate = (perSecond: number): string =>
  perSecond >= 10
    ? `${Math.round(perSecond)}/s`
    : perSecond >= 0.1
      ? `${perSecond.toFixed(1)}/s`
      : '';
