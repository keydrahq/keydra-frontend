import { EngineType } from '@app/Shared/Services/api.types';
import type { ConnectionRequest } from '@app/Shared/Services/api.types';

/** The part of a connection request a URL can say something about. */
export type ParsedConnectionUrl = Partial<
  Pick<ConnectionRequest, 'host' | 'port' | 'username' | 'password' | 'tls' | 'database'>
>;

const SCHEMES = new Map<string, boolean>([
  ['redis:', false],
  ['rediss:', true],
  // Valkey ships the same two under its own name, and a provider that hands one out expects it
  // to be accepted rather than explained.
  ['valkey:', false],
  ['valkeys:', true],
]);

/**
 * What a pasted connection URL says, or nothing if it is not one.
 *
 * <p>Managed Redis is handed out as a single string — Upstash, Redis Cloud, Aiven and the rest all
 * give you {@code rediss://default:token@host:6379} and no separate fields. Retyping that into six
 * boxes is where a character gets dropped from a token, and the failure that follows says
 * "authentication failed" rather than "you mistyped it".
 *
 * <p>Answers nothing rather than guessing. A string that is not one of these schemes is somebody
 * typing a hostname into the wrong box, and filling six fields from it would be worse than leaving
 * them alone.
 */
export const parseConnectionUrl = (value: string): ParsedConnectionUrl | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  const tls = SCHEMES.get(url.protocol);
  if (tls === undefined || !url.hostname) {
    return undefined;
  }

  // The port is optional in the URL and not in a connection, so the scheme's default stands in.
  const port = url.port ? Number(url.port) : 6379;
  // "/2" is database two; an empty path is the default one.
  const path = url.pathname.replace(/^\//, '');
  const database = path && /^\d+$/.test(path) ? Number(path) : 0;

  return {
    host: url.hostname,
    port: Number.isFinite(port) && port > 0 ? port : 6379,
    // Percent-encoding is how a password with an @ or a : travels in a URL, so it comes back out.
    // "default" is a real username on managed Redis rather than a placeholder, so it is kept.
    username: url.username ? decodeURIComponent(url.username) : null,
    password: url.password ? decodeURIComponent(url.password) : null,
    tls,
    database,
  };
};

/**
 * How a target's address is written down for somebody to read.
 *
 * <p>A scheme only where there is one to use. RESP has {@code redis://} and {@code rediss://} and
 * everybody writes them, so a Redis or Valkey target is shown the way its provider handed it over.
 * The others have no such convention — an Aerospike seed node and a TiKV placement driver are both
 * written as a host and a port — and putting {@code redis://} in front of one would be naming the
 * wrong protocol on the target's own page.
 */
export const endpointOf = (profile: {
  engine: EngineType | null;
  host: string;
  port: number;
  tls: boolean;
}): string =>
  profile.engine === EngineType.Resp || profile.engine == null
    ? `${profile.tls ? 'rediss' : 'redis'}://${profile.host}:${profile.port}`
    : `${profile.host}:${profile.port}`;
