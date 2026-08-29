import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';
import { authQueryKey } from '@app/Login/queries';
import type {
  GrantRequest,
  GroupMappingSummary,
  ProviderKind,
  ProviderSummary,
  GrantSummary,
  GroupSummary,
  PermissionInfo,
  RoleSummary,
  ServerGroupSummary,
  UserSummary,
} from './types';

export const accessQueryKey = ['access'] as const;

/**
 * Everything the access pages read is invalidated together.
 *
 * <p>The five tables are one model: putting somebody in a group changes what the grants page
 * means, and deleting a role changes the grants that named it. Invalidating the branch is both
 * simpler than tracking which of them a change touched and less likely to leave one stale.
 */
const useInvalidateAccess = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: accessQueryKey });
};

/** Everything the access pages draw, which is what they ask for. */
export interface AccessPage {
  accounts: UserSummary[];
  groups: GroupSummary[];
  serverGroups: ServerGroupSummary[];
  roles: RoleSummary[];
  grants: GrantSummary[];
  permissionCatalogue: PermissionInfo[];
}

const PAGE = `
  query AccessPage {
    accounts {
      id
      username
      displayName
      email
      provider
      enabled
      hasPassword
      lastSeenAt
      groups
    }
    groups {
      id
      name
      description
      managedBy
      memberUsers
      memberGroups
    }
    serverGroups {
      id
      name
      description
      parentId
      connectionIds
    }
    roles {
      id
      name
      description
      builtIn
      permissions
    }
    grants {
      id
      subjectType
      subjectId
      subjectName
      roleId
      roleName
      scopeType
      scopeId
      scopeName
      grantedBy
      grantedAt
    }
    permissionCatalogue {
      name
      id
      level
    }
  }
`;

/**
 * Everything the access screen needs, asked once.
 *
 * <p>Six requests before, one per table, and each of the five tables is a reading of one model:
 * putting somebody in a group changes what the grants table means, and deleting a role changes
 * the grants that named it. Asking for them apart meant six chances to be looking at a set that
 * disagreed with itself.
 */
const useAccessPageSelecting = <T>(select: (page: AccessPage) => T): UseQueryResult<T, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...accessQueryKey, 'page'],
    queryFn: () => graphql.query<AccessPage>(PAGE),
    select,
  });
};

export const useAccessPage = (): UseQueryResult<AccessPage, Error> =>
  useAccessPageSelecting((page) => page);

/**
 * One table's rows, read off the page's own answer rather than asked for again.
 *
 * <p>Through the query's own `select` rather than by spreading its result and renaming the type.
 * The spread carried `refetch` with it, which still resolved to the whole page however the
 * returned object was labelled — so the label was the only thing that changed, and it did not
 * typecheck for exactly that reason.
 */
const from = <K extends keyof AccessPage>(field: K) =>
  function useSlice(): UseQueryResult<AccessPage[K], Error> {
    return useAccessPageSelecting((page) => page[field]);
  };

export const useUsers = from('accounts');
export const useGroups = from('groups');
export const useServerGroups = from('serverGroups');
export const useRoles = from('roles');
export const useGrants = from('grants');

/** The closed list of permissions, sent by the server so the role editor cannot go stale. */
export const usePermissionCatalog = from('permissionCatalogue');

export interface UserRequest {
  username: string;
  displayName?: string | null;
  email?: string | null;
  /** Absent leaves the stored one alone; the API never sends one back to prefill. */
  password?: string;
  enabled?: boolean;
}

export interface RoleRequest {
  name: string;
  description?: string | null;
  permissions: string[];
}

const M = {
  saveUser: `
    mutation SaveAccount($account: UserRequestInput) {
      createAccount(account: $account) { id }
    }
  `,
  updateUser: `
    mutation UpdateAccount($id: BigInteger, $account: UserRequestInput) {
      updateAccount(id: $id, account: $account) { id }
    }
  `,
  deleteUser: `mutation DeleteAccount($id: BigInteger) { deleteAccount(id: $id) }`,
  createGroup: `
    mutation CreateGroup($group: GroupRequestInput) { createGroup(group: $group) { id } }
  `,
  deleteGroup: `mutation DeleteGroup($id: BigInteger) { deleteGroup(id: $id) }`,
  addMember: `
    mutation AddGroupMember($groupId: BigInteger, $member: MembershipRequestInput) {
      addGroupMember(groupId: $groupId, member: $member)
    }
  `,
  createServerGroup: `
    mutation CreateServerGroup($group: ServerGroupRequestInput) {
      createServerGroup(group: $group) { id }
    }
  `,
  deleteServerGroup: `mutation DeleteServerGroup($id: BigInteger) { deleteServerGroup(id: $id) }`,
  addServer: `
    mutation AddServerToGroup($groupId: BigInteger, $connectionId: BigInteger) {
      addServerToGroup(groupId: $groupId, connectionId: $connectionId)
    }
  `,
  removeServer: `
    mutation RemoveServerFromGroup($groupId: BigInteger, $connectionId: BigInteger) {
      removeServerFromGroup(groupId: $groupId, connectionId: $connectionId)
    }
  `,
  createRole: `mutation CreateRole($role: RoleRequestInput) { createRole(role: $role) { id } }`,
  updateRole: `
    mutation UpdateRole($id: BigInteger, $role: RoleRequestInput) {
      updateRole(id: $id, role: $role) { id }
    }
  `,
  deleteRole: `mutation DeleteRole($id: BigInteger) { deleteRole(id: $id) }`,
  grant: `mutation Grant($grant: GrantRequestInput) { grant(grant: $grant) { id } }`,
  revoke: `mutation Revoke($id: BigInteger) { revoke(id: $id) }`,
};

/** One mutation, run and unwrapped. Every one of these follows the same three lines. */
const useAccessMutation = <V, R>(
  document: string,
  variables: (input: V) => Record<string, unknown>,
  read: (answer: Record<string, R>) => R,
): UseMutationResult<R, Error, V> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (input: V) =>
      graphql.query<Record<string, R>>(document, variables(input)).then(read),
    onSuccess: invalidate,
  });
};

export const useSaveUser = (): UseMutationResult<
  { id: number },
  Error,
  { id?: number; request: UserRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ id, request }) =>
      id === undefined
        ? graphql
            .query<{ createAccount: { id: number } }>(M.saveUser, { account: request })
            .then((a) => a.createAccount)
        : graphql
            .query<{ updateAccount: { id: number } }>(M.updateUser, { id, account: request })
            .then((a) => a.updateAccount),
    onSuccess: invalidate,
  });
};

export const useDeleteUser = (): UseMutationResult<boolean, Error, number> =>
  useAccessMutation<number, boolean>(
    M.deleteUser,
    (id) => ({ id }),
    (a) => a.deleteAccount,
  );

export const useCreateGroup = (): UseMutationResult<
  { id: number },
  Error,
  { name: string; description?: string | null }
> =>
  useAccessMutation(
    M.createGroup,
    (request) => ({ group: request }),
    (a) => a.createGroup,
  );

export const useDeleteGroup = (): UseMutationResult<boolean, Error, number> =>
  useAccessMutation<number, boolean>(
    M.deleteGroup,
    (id) => ({ id }),
    (a) => a.deleteGroup,
  );

export const useAddGroupMember = (): UseMutationResult<
  boolean,
  Error,
  { groupId: number; userId?: number; memberGroupId?: number }
> =>
  useAccessMutation(
    M.addMember,
    ({ groupId, userId, memberGroupId }) => ({
      groupId,
      member: { userId: userId ?? null, memberGroupId: memberGroupId ?? null },
    }),
    (a) => a.addGroupMember,
  );

export const useCreateServerGroup = (): UseMutationResult<
  { id: number },
  Error,
  { name: string; description?: string | null; parentId?: number | null }
> =>
  useAccessMutation(
    M.createServerGroup,
    (request) => ({ group: request }),
    (a) => a.createServerGroup,
  );

export const useDeleteServerGroup = (): UseMutationResult<boolean, Error, number> =>
  useAccessMutation<number, boolean>(
    M.deleteServerGroup,
    (id) => ({ id }),
    (a) => a.deleteServerGroup,
  );

export const useSetServerInGroup = (): UseMutationResult<
  boolean,
  Error,
  { groupId: number; connectionId: number; member: boolean }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ groupId, connectionId, member }) =>
      graphql
        .query<Record<string, boolean>>(member ? M.addServer : M.removeServer, {
          groupId,
          connectionId,
        })
        .then((a) => (member ? a.addServerToGroup : a.removeServerFromGroup)),
    onSuccess: invalidate,
  });
};

export const useSaveRole = (): UseMutationResult<
  { id: number },
  Error,
  { id?: number; request: RoleRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ id, request }) =>
      id === undefined
        ? graphql
            .query<{ createRole: { id: number } }>(M.createRole, { role: request })
            .then((a) => a.createRole)
        : graphql
            .query<{ updateRole: { id: number } }>(M.updateRole, { id, role: request })
            .then((a) => a.updateRole),
    onSuccess: invalidate,
  });
};

export const useDeleteRole = (): UseMutationResult<boolean, Error, number> =>
  useAccessMutation<number, boolean>(
    M.deleteRole,
    (id) => ({ id }),
    (a) => a.deleteRole,
  );

export const useGrant = (): UseMutationResult<{ id: number }, Error, GrantRequest> =>
  useAccessMutation(
    M.grant,
    (request) => ({ grant: request }),
    (a) => a.grant,
  );

export const useRevoke = (): UseMutationResult<boolean, Error, number> =>
  useAccessMutation<number, boolean>(
    M.revoke,
    (id) => ({ id }),
    (a) => a.revoke,
  );

const PROVIDER_FIELDS = `
  id
  key
  displayName
  kind
  enabled
  sortOrder
  issuer
  clientId
  hasClientSecret
  scopes
  authorizationEndpoint
  tokenEndpoint
  userInfoEndpoint
  endpointsDiscovered
  subjectClaim
  usernameClaim
  emailClaim
  nameClaim
  groupsClaim
  autoCreateUsers
  redirectUri
  groupMappings {
    id
    claimValue
    groupId
    groupName
  }
`;

const PROVIDERS = `
  query IdentityProviders {
    identityProviders {
      ${PROVIDER_FIELDS}
    }
  }
`;

/**
 * The providers people can sign in through.
 *
 * <p>Its own query rather than part of the access page, because it needs something the others do
 * not: each answer carries the redirect URI a provider has to be told about, derived from the
 * address this browser reached Keydra at.
 */
export const useProviders = (): UseQueryResult<ProviderSummary[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...accessQueryKey, 'providers'],
    queryFn: () =>
      graphql
        .query<{ identityProviders: ProviderSummary[] }>(PROVIDERS)
        .then((a) => a.identityProviders),
  });
};

export interface ProviderRequest {
  key: string;
  displayName: string;
  kind: ProviderKind;
  enabled?: boolean;
  sortOrder?: number;
  issuer?: string | null;
  clientId: string;
  /** Absent leaves the stored one alone; the API never sends one back to prefill. */
  clientSecret?: string;
  scopes?: string | null;
  authorizationEndpoint?: string | null;
  tokenEndpoint?: string | null;
  userInfoEndpoint?: string | null;
  subjectClaim?: string | null;
  usernameClaim?: string | null;
  emailClaim?: string | null;
  nameClaim?: string | null;
  groupsClaim?: string | null;
  autoCreateUsers?: boolean;
}

const CREATE_PROVIDER = `
  mutation CreateIdentityProvider($provider: ProviderRequestInput) {
    createIdentityProvider(provider: $provider) {
      ${PROVIDER_FIELDS}
    }
  }
`;

const UPDATE_PROVIDER = `
  mutation UpdateIdentityProvider($id: BigInteger, $provider: ProviderRequestInput) {
    updateIdentityProvider(id: $id, provider: $provider) {
      ${PROVIDER_FIELDS}
    }
  }
`;

export const useSaveProvider = (): UseMutationResult<
  ProviderSummary,
  Error,
  { id?: number; request: ProviderRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ id, request }) =>
      id === undefined
        ? graphql
            .query<{ createIdentityProvider: ProviderSummary }>(CREATE_PROVIDER, {
              provider: request,
            })
            .then((a) => a.createIdentityProvider)
        : graphql
            .query<{ updateIdentityProvider: ProviderSummary }>(UPDATE_PROVIDER, {
              id,
              provider: request,
            })
            .then((a) => a.updateIdentityProvider),
    onSuccess: invalidate,
  });
};

const DELETE_PROVIDER = `
  mutation DeleteIdentityProvider($id: BigInteger) {
    deleteIdentityProvider(id: $id)
  }
`;

export const useDeleteProvider = (): UseMutationResult<boolean, Error, number> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (id: number) =>
      graphql
        .query<{ deleteIdentityProvider: boolean }>(DELETE_PROVIDER, { id })
        .then((a) => a.deleteIdentityProvider),
    onSuccess: invalidate,
  });
};

const ADD_MAPPING = `
  mutation AddProviderGroupMapping($providerId: BigInteger, $mapping: GroupMappingRequestInput) {
    addProviderGroupMapping(providerId: $providerId, mapping: $mapping)
  }
`;

export const useAddGroupMapping = (): UseMutationResult<
  boolean,
  Error,
  { providerId: number; claimValue: string; groupId: number }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ providerId, claimValue, groupId }) =>
      graphql
        .query<{ addProviderGroupMapping: boolean }>(ADD_MAPPING, {
          providerId,
          mapping: { claimValue, groupId },
        })
        .then((a) => a.addProviderGroupMapping),
    onSuccess: invalidate,
  });
};

const REMOVE_MAPPING = `
  mutation RemoveProviderGroupMapping($mappingId: BigInteger) {
    removeProviderGroupMapping(mappingId: $mappingId)
  }
`;

export const useRemoveGroupMapping = (): UseMutationResult<boolean, Error, GroupMappingSummary> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (mapping: GroupMappingSummary) =>
      graphql
        .query<{ removeProviderGroupMapping: boolean }>(REMOVE_MAPPING, { mappingId: mapping.id })
        .then((a) => a.removeProviderGroupMapping),
    onSuccess: invalidate,
  });
};

/** A link, and what became of sending it. Shown once; what is stored is a hash of it. */
export interface InvitationIssued {
  mailed: boolean;
  address: string | null;
  link: string | null;
}

const INVITE = `
  mutation InviteAccount($id: BigInteger) {
    inviteAccount(id: $id) {
      mailed
      address
      link
    }
  }
`;

export const useInviteUser = (): UseMutationResult<InvitationIssued, Error, number> => {
  const { graphql } = useContext(ServiceContext);
  return useMutation({
    mutationFn: (id: number) =>
      graphql
        .query<{ inviteAccount: InvitationIssued }>(INVITE, { id })
        .then((a) => a.inviteAccount),
  });
};

// --- What the instance asks of everybody ------------------------------------

/** Mirrors io.keydra.authz.dto.AuthzDtos.SignInPolicyState. */
export interface SignInPolicy {
  secondFactorRequired: boolean;
  changedAt: string | null;
  changedBy: string | null;
  /** How many accounts the requirement reaches and that have not paired an authenticator. */
  accountsOwingAFactor: number;
}

export const signInPolicyQueryKey = [...accessQueryKey, 'sign-in-policy'] as const;

const SIGN_IN_POLICY = `
  query SignInPolicy {
    signInPolicy { secondFactorRequired changedAt changedBy accountsOwingAFactor }
  }
`;

const REQUIRE_SECOND_FACTOR = `
  mutation RequireSecondFactor($required: Boolean!) {
    requireSecondFactor(required: $required) {
      secondFactorRequired
      changedAt
      changedBy
      accountsOwingAFactor
    }
  }
`;

/**
 * What this instance asks of whoever signs in.
 *
 * <p>Its own request rather than a field on the page query the five tables share. It needs a
 * different permission from theirs, and a page query that carried it would fail as a whole for
 * somebody who may manage accounts and may not set the terms they sign in under.
 */
export const useSignInPolicy = (): UseQueryResult<SignInPolicy, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: signInPolicyQueryKey,
    queryFn: () =>
      graphql
        .query<{ signInPolicy: SignInPolicy }>(SIGN_IN_POLICY)
        .then((answer) => answer.signInPolicy),
  });
};

/**
 * Moves the switch.
 *
 * <p>Invalidates the auth state as well as the policy: requiring a factor changes what the account
 * doing the requiring may do — nothing, if it has none — and that answer is the one every page
 * waits on.
 */
export const useRequireSecondFactor = (): UseMutationResult<SignInPolicy, Error, boolean> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (required: boolean) =>
      graphql
        .query<{ requireSecondFactor: SignInPolicy }>(REQUIRE_SECOND_FACTOR, { required })
        .then((answer) => answer.requireSecondFactor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: signInPolicyQueryKey });
      void queryClient.invalidateQueries({ queryKey: authQueryKey });
    },
  });
};
