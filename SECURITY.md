# Security policy

Keydra is three repositories and one product. A vulnerability reported against the wrong one
waits longer and, if it is filed as a public issue, waits in the open.

## Supported versions

Only `main`. Keydra has no tagged frontend release yet, so there is nothing to backport to.

## Reporting a vulnerability

**Do not open a public issue.**

*Security* → *Report a vulnerability* on this repository, or on
[keydra-backend](https://github.com/keydrahq/keydra-backend/security/advisories/new) if the
fault is behind the API rather than in the browser. If you are not sure which, report it here
and say so — moving it is our job, not yours.

Please include what you did, what happened, the commit or image tag, and which browser.

## What is in scope here

The interface holds a session and shows somebody else's data, so:

- **Cross-site scripting.** A key name, a value, a target name, an audit detail — all of it
  is somebody's data rendered on a page, and any of it that reaches the DOM as markup is a
  finding.
- **A permission enforced only in the browser.** Hiding a control is a courtesy; the backend
  refuses regardless. A case where the *backend* does not is a backend report and a serious
  one.
- **Anything that puts a secret where it can be read.** A target password or a token in
  `localStorage`, in a URL, in a query string, in a telemetry payload or in the console.
- **Telemetry that carries what it must not.** Faro is off unless `VITE_FARO_URL` is set, and
  every URL it sends is redacted, because a page address here can hold a key name, a glob or
  a channel. A path that escapes that redaction is a finding.
- **A dependency shipped in the bundle with a known, reachable vulnerability.** Reachable is
  the word: an advisory against code no page loads is an upgrade, not a report.

## What is not

- **A control that is visible but refused.** The navigation hides what a grant does not
  cover, and that is a courtesy rather than the control. Reaching a page and being refused is
  the system working.
- **`KEYDRA_SECURITY_ENABLED=false`.** It admits everybody on purpose, and every page says so
  while it is set.
- **Anything that needs the browser's devtools to reach.** Somebody who can run script in
  their own session is acting as themselves.
- **Findings from a scanner with no demonstrated path through the interface.**

## What to expect

An acknowledgement within three working days and an assessment within ten. Credit in the
release notes unless you would rather not be named.

Please give us a reasonable window before disclosing publicly. If we go quiet, say so in the
thread — that is our failure, not a reason for you to stay quiet.
