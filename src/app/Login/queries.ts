import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '@app/Shared/Services/Api.service';
import { ServiceContext } from '@app/Shared/Services/Services';
import { useCallerSelecting } from '@app/Security/queries';
import type { AuthState, EffectivePermissions, SignInOption } from './types';

export const authQueryKey = ['auth'] as const;

/**
 * What this instance expects of whoever is asking.
 *
 * <p>Everything else waits on this, so it is asked once and kept. It changes exactly twice in a
 * session — at sign-in and at sign-out — and both of those clear it explicitly.
 */
const AUTH_STATE = `
  query AuthState {
    authState {
      securityEnabled
      needsSetup
      authenticated
      username
      mustEnrolSecondFactor
    }
  }
`;

export const useAuthState = (): UseQueryResult<AuthState, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...authQueryKey, 'state'],
    queryFn: async () => {
      try {
        return await graphql
          .query<{ authState: AuthState }>(AUTH_STATE)
          .then((answer) => answer.authState);
      } catch (failure) {
        // A refusal is an answer to this particular question. Asking whether you are signed
        // in is open to anybody, so the only way it comes back 401 is that a cookie was
        // presented and rejected — an ended session, usually, revoked from another browser.
        // Reading that as an error rather than as "no" is what left the page loading forever:
        // the one request everything waits on never resolved into a state.
        if (failure instanceof ApiError && failure.status === 401) {
          return {
            securityEnabled: true,
            needsSetup: false,
            authenticated: false,
            username: '',
            mustEnrolSecondFactor: false,
          };
        }
        throw failure;
      }
    },
    staleTime: Infinity,
    // One retry, because everything else waits on this: a single dropped request while a
    // backend restarts would otherwise send somebody who is signed in back to the form.
    retry: 1,
    // While it is failing, keep asking — and only while it is failing. A server that is
    // restarting comes back on its own, and somebody watching a page that says "Keydra could
    // not be reached" should not have to work out that it is their turn to press something.
    // Three seconds is chosen against a restart, which takes tens of seconds: soon enough that
    // the page turns itself over about when the server is ready, rare enough that a backend
    // that stays down is not being hammered.
    refetchInterval: (query) => (query.state.status === 'error' ? 3_000 : false),
    // The same question is worth re-asking when the tab comes back, because the most common
    // reason a laptop's page is stale is that the laptop was shut.
    refetchOnWindowFocus: true,
  });
};

/**
 * What the caller may do, per target.
 *
 * <p>Asked once for the whole application rather than per button: a page that asked "may I?" for
 * each action would be a request per action, and the answer for every target at once is one query
 * on the server. Read off the one question about the caller rather than asked separately — it used
 * to be its own request fired a millisecond after that one, about the same person, and held for
 * the same session.
 *
 * <p>Reshaped back into the map everything already reads: keyed by connection id as a string,
 * because that is what a JSON key is and what usePermissionCheck looks one up by. GraphQL has no
 * map type, so the graph answers a list of named pairs.
 */
export const useEffectivePermissions = (): UseQueryResult<EffectivePermissions, Error> =>
  useCallerSelecting((caller) => {
    const held = caller.effectivePermissions;
    return {
      username: held.username,
      securityEnabled: held.securityEnabled,
      instance: held.instance,
      connections: Object.fromEntries(
        held.targets.map((target) => [String(target.connectionId), target.permissions]),
      ),
    };
  });

/**
 * The providers this instance offers.
 *
 * <p>Open, and asked before anybody has signed in — the login page has to know whether it is a
 * password form, a row of buttons, or both.
 */
const SIGN_IN_OPTIONS = `
  query SignInOptions {
    signInOptions {
      key
      displayName
      kind
    }
  }
`;

export const useSignInOptions = (): UseQueryResult<SignInOption[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...authQueryKey, 'providers'],
    queryFn: () =>
      graphql
        .query<{ signInOptions: SignInOption[] }>(SIGN_IN_OPTIONS)
        .then((answer) => answer.signInOptions),
    staleTime: Infinity,
    retry: false,
  });
};

/** Where a provider's flow begins. A navigation, not a request: it ends somewhere else. */
export const signInHref = (key: string): string => `/api/v1/auth/providers/${key}/start`;

export interface Credentials {
  username: string;
  password: string;
  /**
   * The authenticator's six digits, when the account has one.
   *
   * <p>Posted with the password rather than exchanged for a half-authenticated token: there is
   * then no intermediate state to expire, to leak or to be replayed. The page does not know
   * whether it is wanted until the server says so, so it asks without one and asks again with one.
   */
  code?: string;
}

/** What the refusal carries when the password was right and a code is wanted. */
export const SECOND_FACTOR_HEADER = 'X-Keydra-Second-Factor';

/** Whether this failure means "show the code field" rather than "that was wrong". */
export const wantsSecondFactor = (error: unknown): boolean =>
  error instanceof ApiError && error.headers.get(SECOND_FACTOR_HEADER) === 'required';

export const useSignIn = (): UseMutationResult<void, Error, Credentials> => {
  const { api } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password, code }: Credentials) =>
      api.doPostForm<void>('/auth/login', {
        username,
        password,
        ...(code ? { code } : {}),
      }),
    // Everything already loaded was loaded as somebody else — usually as nobody.
    onSuccess: () => queryClient.invalidateQueries(),
  });
};

export const useSignOut = (): UseMutationResult<void, Error, void> => {
  const { api } = useContext(ServiceContext);
  return useMutation({
    mutationFn: () => api.doPost<void>('/auth/logout'),
    // A full reload rather than a cache reset: signing out has to leave nothing of the
    // previous person on screen, and the surest way to hold nothing is to have loaded nothing.
    onSettled: () => window.location.assign('/'),
  });
};

export interface FirstAdministrator {
  username: string;
  displayName?: string;
  email?: string;
  password: string;
}

export const useCreateFirstAdministrator = (): UseMutationResult<
  unknown,
  Error,
  FirstAdministrator
> => {
  const { api } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (administrator: FirstAdministrator) =>
      api.doPost<unknown>('/auth/setup', administrator),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authQueryKey }),
  });
};

/**
 * Asks whether the caller holds a permission — over Keydra itself, or over one target.
 *
 * <p>A function rather than a hook per question, because the places that need it most ask it once
 * per item in a list, and a hook cannot be called in a loop.
 *
 * <p>Answers true while the answer is unknown and true when nothing is being enforced. Hiding an
 * action from somebody who may take it is worse than showing one that will be refused: the refusal
 * explains itself, the absence looks like the feature was never built.
 */
export const usePermissionCheck = (): ((permission: string, connectionId?: number) => boolean) => {
  const permissions = useEffectivePermissions();
  const held = permissions.data;

  return (permission: string, connectionId?: number) => {
    if (!held || !held.securityEnabled) {
      return true;
    }
    return connectionId === undefined
      ? held.instance.includes(permission)
      : (held.connections[String(connectionId)] ?? []).includes(permission);
  };
};

/** The same question for one permission, where only one is being asked about. */
export const useHoldsPermission = (permission: string, connectionId?: number): boolean =>
  usePermissionCheck()(permission, connectionId);

/** The permission names, mirroring io.keydra.authz.entity.Permission. */
export const Permission = {
  ConnectionView: 'CONNECTION_VIEW',
  ConnectionCreate: 'CONNECTION_CREATE',
  ConnectionEdit: 'CONNECTION_EDIT',
  ConnectionDelete: 'CONNECTION_DELETE',
  KeysRead: 'KEYS_READ',
  ConsoleRun: 'CONSOLE_RUN',
  CommandsWatch: 'COMMANDS_WATCH',
  PubSubSubscribe: 'PUBSUB_SUBSCRIBE',
  AnalysisRead: 'ANALYSIS_READ',
  MonitoringRead: 'MONITORING_READ',
  ServerRead: 'SERVER_READ',
  AclRead: 'ACL_READ',
  UsersManage: 'USERS_MANAGE',
  GroupsManage: 'GROUPS_MANAGE',
  GrantsManage: 'GRANTS_MANAGE',
  IdpManage: 'IDP_MANAGE',
  AuditRead: 'AUDIT_READ',
  InstanceRead: 'INSTANCE_READ',
  InstanceDrain: 'INSTANCE_DRAIN',
  KeysDelete: 'KEYS_DELETE',
  MigrationRun: 'MIGRATION_RUN',
  TransferExport: 'TRANSFER_EXPORT',
  ScheduleManage: 'SCHEDULE_MANAGE',
  AlertManage: 'ALERT_MANAGE',
  AlertDeliveryManage: 'ALERT_DELIVERY_MANAGE',
  TransferImport: 'TRANSFER_IMPORT',
  BackupManage: 'BACKUP_MANAGE',
  TunnelManage: 'TUNNEL_MANAGE',
  CryptoRotate: 'CRYPTO_ROTATE',
  PolicyManage: 'POLICY_MANAGE',
  ServerConfigure: 'SERVER_CONFIGURE',
} as const;

/** What a link is worth, mirroring io.keydra.authz.rest.Invitations.StandingResponse. */
export interface InvitationStanding {
  usable: boolean;
  /** UNKNOWN, EXPIRED or USED when it is not usable. */
  refusal: 'UNKNOWN' | 'EXPIRED' | 'USED' | null;
  username: string | null;
  displayName: string | null;
  /** INVITATION or RESET, which decides the wording. */
  purpose: 'INVITATION' | 'RESET' | null;
}

/**
 * Whether a link can still be used.
 *
 * <p>Asked before the password form is shown, so somebody who followed an old mail is told which of
 * the three things happened rather than being refused after choosing a password.
 *
 * <p>Not retried: every answer here is a final one, including the refusals.
 */
export const useInvitationStanding = (token: string): UseQueryResult<InvitationStanding, Error> => {
  const { api } = useContext(ServiceContext);
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.doGet<InvitationStanding>(`/invitations/${encodeURIComponent(token)}`),
    retry: false,
    staleTime: Infinity,
  });
};

/** Spends the link and sets the password. */
export const useAcceptInvitation = (
  token: string,
): UseMutationResult<InvitationStanding, Error, string> => {
  const { api } = useContext(ServiceContext);
  return useMutation({
    mutationFn: (password: string) =>
      api.doPost<InvitationStanding>(`/invitations/${encodeURIComponent(token)}`, {
        password,
      }),
  });
};

/**
 * Asks for a link because a password has been forgotten.
 *
 * <p>Succeeds whether or not there is such an account, because the server answers the same way
 * either way — a form that showed "no such user" would be a way to ask Keydra who is here.
 */
export const useForgottenPassword = (): UseMutationResult<void, Error, string> => {
  const { api } = useContext(ServiceContext);
  return useMutation({
    mutationFn: (username: string) => api.doPost<void>('/invitations/forgotten', { username }),
  });
};
