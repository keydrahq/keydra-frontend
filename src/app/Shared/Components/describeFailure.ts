import type { TFunction } from 'i18next';
import { ApiError } from '@app/Shared/Services/Api.service';
import { GraphQLError } from '@app/Shared/Services/GraphQL.service';

export interface Described {
  /** What happened, in the reader's terms. */
  body: string;
  /** Whether trying the same thing again could work. Decides if a retry button is offered. */
  worthRetrying: boolean;
  /** The original text, for somebody who is debugging. Never the whole message. */
  detail?: string;
}

/**
 * Turns a failure into something worth reading.
 *
 * <p>What was on screen was the exception's own words: "Request to /graphql failed: 500 Internal
 * Server Error". That names an internal path, quotes a status code, and tells the reader nothing
 * they can act on — three things PatternFly's content design rules out in one line. An error says
 * what happened and what to do about it, in that order, and never blames the reader.
 *
 * <p>The technical text is not thrown away. It moves to a second line, below the sentence that
 * explains the situation, because the person who needs "500" is not the person reading the first
 * line — and the first line is what everybody reads.
 *
 * <p>Grouped by what the reader can do rather than by status code. A 401 and a 403 are different
 * to a server and the same to somebody looking at a page: they cannot see this, and clicking again
 * will not change that.
 */
export const describeFailure = (failure: unknown, t: TFunction): Described => {
  if (failure instanceof ApiError) {
    return fromStatus(failure.status, failure.message, t);
  }
  if (failure instanceof GraphQLError) {
    // The server has already decided what it is willing to say — in production that is a fixed
    // sentence, deliberately. Passing it through unchanged is the honest thing; what this adds is
    // the line saying what to do next.
    return {
      body: t('Failure.REFUSED'),
      worthRetrying: true,
      detail: failure.message,
    };
  }
  if (failure instanceof Error) {
    // Everything that never reached a server: the network, a dropped connection, a backend that is
    // restarting. The browser's own wording for these is famously unhelpful ("Failed to fetch"),
    // so it goes in the detail line and not the first one.
    return { body: t('Failure.UNREACHABLE'), worthRetrying: true, detail: failure.message };
  }
  return { body: t('Failure.UNKNOWN'), worthRetrying: true };
};

const fromStatus = (status: number, message: string, t: TFunction): Described => {
  if (status === 401) {
    return { body: t('Failure.SIGNED_OUT'), worthRetrying: false };
  }
  if (status === 403) {
    return { body: t('Failure.NOT_ALLOWED'), worthRetrying: false };
  }
  if (status === 404) {
    return { body: t('Failure.GONE'), worthRetrying: false };
  }
  if (status === 408) {
    return { body: t('Failure.TOO_SLOW'), worthRetrying: true, detail: message };
  }
  if (status === 429) {
    return { body: t('Failure.TOO_MANY'), worthRetrying: true };
  }
  // 502, 503 and 504 are what stands between the browser and Keydra saying it could not get
  // there — the dev proxy, an ingress, a load balancer. They mean Keydra is not answering, which
  // is a different thing from Keydra answering badly, and telling somebody "the server ran into a
  // problem" while it is not running at all sends them looking through a log that has nothing in
  // it. 504 is here rather than with the timeouts for the same reason: a gateway that gave up
  // waiting could not reach it either.
  if (status === 502 || status === 503 || status === 504) {
    return { body: t('Failure.UNREACHABLE'), worthRetrying: true, detail: message };
  }
  if (status >= 500) {
    return { body: t('Failure.SERVER'), worthRetrying: true, detail: message };
  }
  // A 4xx that is none of the above is something the request itself got wrong, and the server's
  // own words are the useful part — those are written by Keydra and say what was refused.
  return { body: message, worthRetrying: false };
};
