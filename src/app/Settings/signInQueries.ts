import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';

/** One attempt to sign in, mirroring io.keydra.authz.dto.SignInActivity. */
export interface SignInActivity {
  id: string;
  username: string;
  /** SUCCEEDED, WRONG_PASSWORD, NO_SUCH_ACCOUNT or REFUSED_TOO_MANY. */
  outcome: string;
  /** `password`, or the key of the provider that vouched. */
  method: string;
  at: string;
  /** The address with its last part removed — never the address. */
  network: string | null;
  /** Two letters, where this instance can place an address. */
  country: string | null;
  userAgent: string | null;
  /** What was unusual about it, which for almost every row is nothing. */
  anomalies: string[];
}

export const mySignInsKey = ['signIns', 'mine'] as const;

const MINE = `
  query MySignIns($first: Int, $offset: Int) {
    mySignIns(first: $first, offset: $offset) {
      id
      username
      outcome
      method
      at
      network
      country
      userAgent
      anomalies
    }
    mySignInCount
  }
`;

interface MineAnswer {
  mySignIns: SignInActivity[];
  mySignInCount: number;
}

/**
 * Your own sign-ins, newest first.
 *
 * <p>One query for the page and its count, rather than two. The count is what the pagination needs
 * and asking for it separately would be a second request for a number that arrives free.
 */
export const useMySignIns = (first: number, offset: number): UseQueryResult<MineAnswer, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...mySignInsKey, first, offset],
    queryFn: () => graphql.query<MineAnswer>(MINE, { first, offset }),
  });
};

export const flaggedSignInsKey = ['signIns', 'flagged'] as const;

const FLAGGED = `
  query FlaggedSignIns($days: Int, $first: Int, $offset: Int) {
    flaggedSignIns(days: $days, first: $first, offset: $offset) {
      id
      username
      outcome
      method
      at
      network
      country
      userAgent
      anomalies
    }
    flaggedSignInCount(days: $days)
    refusedSignIns(days: $days, first: $first) {
      id
      username
      outcome
      method
      at
      network
      country
      userAgent
      anomalies
    }
  }
`;

interface WatchAnswer {
  flaggedSignIns: SignInActivity[];
  flaggedSignInCount: number;
  refusedSignIns: SignInActivity[];
}

/**
 * What was unusual and what was refused, across everybody.
 *
 * <p>Both halves in one question, because they are read together: a run of refusals and a success
 * that followed it are the same event seen from two sides, and two requests would draw them from
 * two moments.
 */
export const useSignInWatch = (
  days: number,
  first: number,
  offset: number,
): UseQueryResult<WatchAnswer, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...flaggedSignInsKey, days, first, offset],
    queryFn: () => graphql.query<WatchAnswer>(FLAGGED, { days, first, offset }),
  });
};
