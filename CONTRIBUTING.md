# Contributing to keydra-frontend

Thank you for taking the time. This file is what a pull request is read against, so it is
short and specific rather than encouraging.

## Getting set up

```bash
nvm use && corepack enable && yarn install
yarn dev:mock      # the whole interface, no backend needed
yarn lint && yarn test:ci
```

`yarn dev` proxies to a backend on `:8181`. `yarn dev:mock` does not need one, and is the
faster loop for anything that is not about a real server's answers.

## The rules a review will hold you to

**No sentence lives in a component.** Every string a person reads comes from
`locales/{en,tr}/`, through `t()`. A hard-coded label is a label that exists in one language,
and it will be found by the reader rather than by the reviewer.

**Both languages, in the same pull request.** `src/test/i18n/locales.test.ts` fails when the
two files disagree about which keys exist, so a missing translation is a red build rather
than an English word in a Turkish interface. If you do not write Turkish, say so in the pull
request and put the English in both — an honest placeholder somebody can find beats a key
that quietly falls back.

**A label is a fact, not a sentence you compose.** When the server sends a stable key —
`runs-code`, `console.run`, `database` — the sentence is written here, in the locale files.
Do not send prose from the backend and do not rebuild a sentence from fragments the
translator cannot reorder; Turkish does not put the verb where English does.

**PatternFly's content rules, not house style.** Sentence case everywhere except proper nouns
(Pub/Sub, TTL, OAuth 2). No full stop on a label, a title or a button; one on body text.
Numerals for numbers, with a space before the unit — `2.0 MiB`, never `2.0MiB`. A truncated
string is always reachable in full. An error says what happened and what to do about it, in
that order, and never blames the reader. A tooltip that repeats the label is not written.

The Turkish follows Turkish orthography rather than these rules — sentence case is not a
decision English gets to make for another language — but the rules about full stops, units
and unreachable truncation hold in both.

**Use PatternFly's components and tokens.** No custom CSS where a component exists, and no
raw colour where a token does: the four themes are classes, and a colour picked for one of
them is wrong in the other three. Keep the accessibility props intact, and give every icon
button an `aria-label`.

**The interface never polls.** Server-side changes arrive on the notification socket. If you
find yourself adding an interval, the question is which broadcast is missing.

**A capability a target does not have is absent.** Build tabs and actions from what the
server answered about that target, not from a list in the frontend.

## Tests

Vitest and React Testing Library, for components with logic. Do not chase coverage on pure
layout.

Assert on what a person can see and do — a role, a label, a value — rather than on an
implementation detail. A test that reaches for a class name breaks on a PatternFly upgrade
and tells you nothing about the interface.

Keep `src/mocks/handlers.ts` honest: a mock that answers something the real server would not
is a mock that teaches the wrong thing, and `yarn dev:mock` is how most of this gets looked
at.

## Style

Prettier and ESLint, both checked by `yarn lint` along with `tsc -b`. `yarn prettier:apply`
and `yarn eslint:apply` fix what can be fixed.

Comments explain *why*, not *what*.

No `TODO` without a linked issue.

## Commits and pull requests

Small and reviewable, one concern each. Before opening one:

```bash
yarn lint && yarn test:ci
```

A screenshot in the description is worth a paragraph, and for anything visual it is worth
two: light and dark.

## Reporting a security problem

Do not open an issue. See [SECURITY.md](SECURITY.md).

## Licence

By contributing, you agree that your contributions are licensed under the Apache License 2.0,
the same terms that cover the rest of this repository.
