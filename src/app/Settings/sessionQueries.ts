import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';

/** One browser that is signed in, mirroring io.keydra.authz.dto.SessionSummary. */
export interface Session {
  id: string;
  /** Whether this is the session reading the page. Ending it signs you out. */
  current: boolean;
  issuedAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  /** The browser as it described itself — a label, not evidence. */
  userAgent: string | null;
  /** The address with its last part removed. */
  network: string | null;
}

/** One page of them, and how many there are altogether. */
export interface SessionsAnswer {
  mySessions: Session[];
  /** Everything, not this page — which is what a pager needs and a page of rows cannot say. */
  mySessionCount: number;
}

const SESSIONS_KEY = ['sessions'] as const;

const SESSIONS = `
  query MySessions($first: Int, $offset: Int) {
    mySessions(first: $first, offset: $offset) {
      id
      current
      issuedAt
      lastSeenAt
      expiresAt
      userAgent
      network
    }
    mySessionCount
  }
`;

/**
 * One page of the browsers you are signed in on.
 *
 * <p>The browser reading the page comes first and the rest follow by age, which is decided on the
 * server: the row carrying the action that signs somebody out is not one to make them page to.
 */
export const useSessions = (
  first: number,
  offset: number,
): UseQueryResult<SessionsAnswer, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...SESSIONS_KEY, first, offset],
    queryFn: () => graphql.query<SessionsAnswer>(SESSIONS, { first, offset }),
  });
};

const END = `
  mutation EndSession($id: String) {
    endSession(id: $id)
  }
`;

/** Ends one session. Ending your own is signing out, so the caller reloads afterwards. */
export const useEndSession = (): UseMutationResult<boolean, Error, string> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      graphql.query<{ endSession: boolean }>(END, { id }).then((a) => a.endSession),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
};

const END_OTHERS = `
  mutation EndOtherSessions {
    endOtherSessions
  }
`;

/** Ends every session except this one, and answers how many that was. */
export const useEndOtherSessions = (): UseMutationResult<number, Error, void> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      graphql.query<{ endOtherSessions: number }>(END_OTHERS).then((a) => a.endOtherSessions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
};
