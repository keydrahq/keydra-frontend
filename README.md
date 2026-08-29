# keydra-frontend

[![CI](https://github.com/keydrahq/keydra-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/keydrahq/keydra-frontend/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

The interface of [Keydra](https://github.com/keydrahq), a web-based management console for
key-value servers — **Redis**, **Valkey**, **KeyDB**, **Dragonfly**, **Garnet**,
**Aerospike** and **TiKV**.

React and PatternFly, in English and Turkish. It talks to
[keydra-backend](https://github.com/keydrahq/keydra-backend) only over the REST/WebSocket API,
and it can be developed without the backend running at all.

## What it is

React and PatternFly, built by Vite, in TypeScript, with server state through TanStack
Query. Yarn 4 through Corepack; Node is pinned by `.nvmrc`. Exact versions are in
`package.json`, which is the only place they cannot go stale.

- **One socket for the whole application.** Every page listens to `/api/v1/notifications`
  rather than polling: a target going up, a key changing, a fresh metrics reading and a
  migration's progress all arrive on it, so the interface changes when the server does.
- **The pages ask GraphQL and the files ask REST.** Nearly everything a page reads and
  changes goes to `/graphql`; exports, imports, values, signing in and the sockets stay on
  `/api/v1` because those are shapes GraphQL is wrong for.
- **What a target cannot do is absent, not broken.** The tab bar is built from what the
  server answered about that target: an Aerospike target arrives with three tabs where a
  Redis one has eleven.
- **Bilingual from the first commit.** i18next with English as the source and Turkish beside
  it, and a test that fails when the two disagree about which keys exist.

## Running it

```bash
nvm use            # Node from .nvmrc
corepack enable    # yarn 4, no global install
yarn install

yarn dev           # http://localhost:9000, proxying /api and /graphql to :8181
```

### Without the backend

```bash
yarn dev:mock      # MSW answers the API from src/mocks/handlers.ts
```

This is a complete instance: targets, keys, schedules, alerts, a fleet that reports itself.
It is what makes a UI change reviewable without standing up PostgreSQL and a Redis, and the
handlers are kept honest — a mock that answers something the server would not is a mock that
teaches the wrong thing.

## Checks

```bash
yarn lint          # prettier --check, eslint, tsc -b
yarn test:ci       # Vitest + React Testing Library
yarn test          # the same, with coverage
```

Both run on every pull request.

## How it is arranged

`src/app/` mirrors [cryostat-web](https://github.com/cryostatio/cryostat-web):

| | |
|---|---|
| `AppLayout/` | Page, masthead, navigation, the theme and language controls |
| `routes.tsx` | the route table, which is also what the navigation is built from |
| `<Feature>/` | one folder per feature — components and their own hooks together |
| `Shared/Services/` | the typed API client, the notification socket, settings |
| `Shared/Components/` | the pieces more than one feature uses |
| `mocks/` | the MSW instance `yarn dev:mock` serves |

Interface text lives in `locales/{en,tr}/`, never in a component.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers what a pull request is read against — most of it
about PatternFly's content rules and about not writing a sentence in a component. Security
reports go through [SECURITY.md](SECURITY.md) rather than the issue tracker.

## Licence

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
