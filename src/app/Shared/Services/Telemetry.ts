/**
 * What the browser half of Keydra says about itself, when somebody is collecting it.
 *
 * Off unless `VITE_FARO_URL` names a collector, and loaded only then: the package is not
 * small, and an application that is not sending anywhere should not be paying to be able to.
 * That is why this file imports nothing at the top — the import happens inside the function,
 * after the decision.
 *
 * What it sends: errors and their stacks, web vitals, page loads, and a span per request the
 * page makes, which carries the trace header on to the backend so a slow page and a slow query
 * turn out to be the same trace. What it deliberately does not send is below, and it is the
 * reason this file is longer than three lines.
 */

/** Where a collector was named, or nothing — which is the ordinary case. */
const collectorUrl = (): string | undefined => {
  const named = import.meta.env.VITE_FARO_URL;
  return typeof named === 'string' && named.trim() !== '' ? named.trim() : undefined;
};

/**
 * Path segments after which the next one is somebody's data rather than Keydra's structure.
 *
 * A key name is the contents of a target — `user:42:session` says who, and half of what — and
 * it appears in a URL both in the address bar and in the requests the page makes. Telemetry
 * leaves the machine; key names do not. The same goes for a channel somebody subscribed to and
 * for a glob they typed.
 */
const AFTER_THESE_IS_DATA = new Set(['keys', 'key', 'values', 'value', 'channels', 'channel']);

/** Absolute URLs anywhere inside a string — an error message can carry one too. */
const ABSOLUTE_URL = /https?:\/\/[^\s"'<>\\]+/g;

/** A string that is nothing but a path, which is how a request often names itself. */
const PATH_ONLY = /^\/[^\s"'<>\\]*$/;

/**
 * One URL with the parts that are somebody's data taken out.
 *
 * <p>Query and fragment go entirely: `?match=user:*` and `#user:42` are the same disclosure by
 * another route, and no query string in this application is worth keeping. The path keeps its
 * shape — which is what makes a span useful — up to the segment that names something inside a
 * target.
 *
 * <p>What goes in decides what comes out: a path stays a path, an address stays an address.
 * Turning one into the other would be a second thing to be wrong about.
 */
export const redactUrl = (raw: string): string => {
  const relative = !/^https?:\/\//i.test(raw);
  let url: URL;
  try {
    url = new URL(raw, 'http://redacted.invalid');
  } catch {
    // Not a URL this application made. Nothing in it can be trusted to be structure rather
    // than data.
    return '…';
  }
  const kept: string[] = [];
  for (const segment of url.pathname.split('/')) {
    kept.push(segment);
    if (AFTER_THESE_IS_DATA.has(segment)) {
      kept.push('…');
      break;
    }
  }
  const path = kept.join('/');
  return relative ? path : `${url.origin}${path}`;
};

/** Every URL inside a string, redacted; strings that are not URLs are left alone. */
export const redactText = (text: string): string => {
  if (PATH_ONLY.test(text)) {
    return redactUrl(text);
  }
  return text.replace(ABSOLUTE_URL, (found) => redactUrl(found));
};

/**
 * Walks a whole telemetry item and redacts every URL in it.
 *
 * <p>Recursive on purpose. Faro sends five shapes of thing — logs, exceptions, events,
 * measurements and spans — and each one carries addresses in a different place: an event has
 * them in its attributes, a resource timing calls one `name`, a span attribute calls it
 * `url.full`, and an exception can have one in its stack. A redaction that names the fields it
 * knows about is a redaction that leaks the next field somebody adds, and this is the one part
 * of the frontend where being wrong means sending somebody's keys to another machine.
 */
const redactEverything = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return redactText(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactEverything);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      record[key] = redactEverything(record[key]);
    }
    return record;
  }
  return value;
};

/**
 * Starts sending, if a collector was named.
 *
 * @returns whether anything was started, which is what a test asserts on
 */
export const startTelemetry = async (): Promise<boolean> => {
  const url = collectorUrl();
  if (!url) {
    return false;
  }

  const [{ initializeFaro, getWebInstrumentations }, { TracingInstrumentation }] =
    await Promise.all([import('@grafana/faro-web-sdk'), import('@grafana/faro-web-tracing')]);

  initializeFaro({
    url,
    app: {
      name: 'keydra-web',
      version: import.meta.env.VITE_APP_VERSION ?? 'dev',
      environment: import.meta.env.MODE,
    },
    instrumentations: [
      // Errors, web vitals and page loads, and deliberately not the console: console
      // arguments are whatever somebody happened to log, which in a console for a key-value
      // store is sooner or later a value.
      ...getWebInstrumentations({ captureConsole: false }),
      new TracingInstrumentation(),
    ],
    sessionTracking: {
      enabled: true,
      // For the length of a tab and no longer. A session that outlives the browser is a way
      // of recognising somebody tomorrow, which is not what this is for.
      persistent: false,
    },
    beforeSend: (item) => redactEverything(item) as typeof item,
  });
  return true;
};
