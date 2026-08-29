import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { useHubRefresh } from '@app/Shared/Components/useHubRefresh';
import type { AclUser, AuditEntry, CurrentUser } from './types';

export const securityQueryKey = ['security'] as const;

const ME = `
  query Me {
    me {
      name
      roles
      securityEnabled
    }
    effectivePermissions {
      username
      securityEnabled
      instance
      targets {
        connectionId
        permissions
      }
    }
  }
`;

/** What the one question about the caller answers: who they are, and what they may do. */
export interface Caller {
  me: CurrentUser;
  effectivePermissions: {
    username: string;
    securityEnabled: boolean;
    instance: string[];
    targets: { connectionId: number; permissions: string[] }[];
  };
}

export const callerQueryKey = [...securityQueryKey, 'caller'] as const;

/**
 * Who is asking, and what they may do — one question rather than two.
 *
 * <p>They were two queries fired within a millisecond of each other on every sign-in, both about
 * the same person, both held for the session. Asking them together is what the second surface is
 * for.
 */
export const useCallerSelecting = <T>(select: (caller: Caller) => T): UseQueryResult<T, Error> => {
  const { graphql } = useContext(ServiceContext);

  /*
   * Held for the session, and that was a bug on its own until this line.
   *
   * What the caller may do is answered per target, so the answer names the targets that existed
   * when it was given. Add one and it is missing from that answer — and every check about it comes
   * back false, which is not "you may not" but "I have never heard of it". What that looked like
   * was a target somebody had just created showing one button: no edit, no delete, none of its own
   * pages. It read as a permission problem and was a stale cache.
   *
   * The catalogue changing is the event that invalidates this, and it comes over the hub rather
   * than from the mutation that caused it — so a target created on another instance, or by
   * somebody else, or by a schedule, is covered by the same line.
   */
  useHubRefresh(
    [NotificationCategory.ConnectionCreated, NotificationCategory.ConnectionDeleted],
    callerQueryKey,
  );

  return useQuery({
    queryKey: callerQueryKey,
    queryFn: () => graphql.query<Caller>(ME),
    staleTime: Infinity,
    retry: false,
    select,
  });
};

export const useCaller = (): UseQueryResult<Caller, Error> =>
  useCallerSelecting((caller) => caller);

/**
 * Who Keydra thinks is asking.
 *
 * <p>Held for the session: an identity does not change while a page is open, and refetching it
 * would put a request behind every render that asks what the user may do.
 */
export const useCurrentUser = (): UseQueryResult<CurrentUser, Error> =>
  useCallerSelecting((caller) => caller.me);

/**
 * Whether the current user holds a role.
 *
 * <p>Answers true while the answer is unknown and true when nothing is being enforced. Hiding an
 * action from someone who may take it is worse than showing one that will be refused: the refusal
 * explains itself, the absence looks like the feature was never built.
 */
export const useHasRole = (role: string): boolean => {
  const user = useCurrentUser();
  if (!user.data) {
    return true;
  }
  return !user.data.securityEnabled || user.data.roles.includes(role);
};

export interface AuditFilters {
  actor?: string;
  action?: string;
  connectionId?: number;
  limit?: number;
}

/** Where a page sits in the log, as the server describes it. */
export interface PageInfo {
  startCursor: string | null;
  endCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Everything the audit page draws, which is what it asks for. */
export interface AuditPage {
  auditLog: {
    totalCount: number;
    nodes: AuditEntry[];
    pageInfo: PageInfo;
  };
  auditActions: string[];
  connections: { id: number; name: string }[];
}

/** What one page of the table asks about. */
export interface AuditPageQuery {
  actor?: string;
  action?: string;
  first: number;
  /** Where to resume, or undefined for the newest page. */
  after?: string;
}

const AUDIT_PAGE = `
  query AuditPage($actor: String, $action: String, $first: Int!, $after: String) {
    auditLog(actor: $actor, action: $action, first: $first, after: $after) {
      totalCount
      nodes {
        id
        at
        actor
        action
        connectionId
        succeeded
        detail
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
      }
    }
    auditActions
    connections {
      id
      name
    }
  }
`;

/**
 * The audit page, asked once.
 *
 * <p>Three questions used to be three requests — the entries, the list of actions a filter can
 * offer, and the whole connection catalogue so a row could name a target instead of numbering it.
 *
 * <p>Resumed from a cursor rather than counted to from the start. The log takes a row every time
 * anybody does anything, so between reading one page and asking for the next there are new rows at
 * the front; with an offset those push the list down and page two begins with something that was
 * already on page one.
 */
export const useAuditPage = (request: AuditPageQuery): UseQueryResult<AuditPage, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...securityQueryKey, 'audit', 'page', request],
    queryFn: () =>
      graphql.query<AuditPage>(AUDIT_PAGE, {
        actor: request.actor ?? null,
        action: request.action ?? null,
        first: request.first,
        after: request.after ?? null,
      }),
    // A page already fetched stays on screen while the next one loads, so paging through does
    // not blink the table away between clicks.
    placeholderData: (previous) => previous,
  });
};

export const aclQueryKey = (connectionId: number) => ['acl', connectionId] as const;

const ACL_USERS = `
  query AclUsers($connectionId: BigInteger) {
    aclUsers(connectionId: $connectionId) {
      username
      enabled
      hasPassword
      commands
      keyPatterns
      channelPatterns
      rules
    }
  }
`;

export const useAclUsers = (connectionId: number): UseQueryResult<AclUser[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: aclQueryKey(connectionId),
    queryFn: () =>
      graphql.query<{ aclUsers: AclUser[] }>(ACL_USERS, { connectionId }).then((a) => a.aclUsers),
  });
};

const SET_ACL_USER = `
  mutation SetAclUser($connectionId: BigInteger, $user: AclUserRequestInput) {
    setAclUser(connectionId: $connectionId, user: $user)
  }
`;

export const useSetAclUser = (
  connectionId: number,
): UseMutationResult<boolean, Error, { username: string; rules: string[] }> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, rules }: { username: string; rules: string[] }) =>
      graphql
        .query<{ setAclUser: boolean }>(SET_ACL_USER, { connectionId, user: { username, rules } })
        .then((a) => a.setAclUser),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aclQueryKey(connectionId) }),
  });
};

const DELETE_ACL_USER = `
  mutation DeleteAclUser($connectionId: BigInteger, $username: String) {
    deleteAclUser(connectionId: $connectionId, username: $username)
  }
`;

export const useDeleteAclUser = (
  connectionId: number,
): UseMutationResult<boolean, Error, string> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) =>
      graphql
        .query<{ deleteAclUser: boolean }>(DELETE_ACL_USER, { connectionId, username })
        .then((a) => a.deleteAclUser),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aclQueryKey(connectionId) }),
  });
};
