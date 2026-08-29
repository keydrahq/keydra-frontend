/** Wire types for the permission model, mirroring io.keydra.authz.dto.AuthzDtos. */

export interface UserSummary {
  id: number;
  username: string;
  displayName: string | null;
  email: string | null;
  /** "local" for an account Keydra keeps, otherwise the identity provider's name. */
  provider: string;
  enabled: boolean;
  /** Whether a password is set. The password itself never leaves the server, hashed or not. */
  hasPassword: boolean;
  lastSeenAt: string | null;
  groups: string[];
}

export interface GroupSummary {
  id: number;
  name: string;
  description: string | null;
  managedBy: string | null;
  memberUsers: string[];
  memberGroups: string[];
}

export interface ServerGroupSummary {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  connectionIds: number[];
}

export interface RoleSummary {
  id: number;
  name: string;
  description: string | null;
  /** One of the three defined in code; it cannot be edited or deleted. */
  builtIn: boolean;
  permissions: string[];
}

export type SubjectType = 'USER' | 'GROUP';
export type ScopeType = 'INSTANCE' | 'SERVER_GROUP' | 'CONNECTION';

/** The sentence: this subject holds this role on this scope. */
export interface GrantSummary {
  id: number;
  subjectType: SubjectType;
  subjectId: number;
  subjectName: string;
  scopeType: ScopeType;
  scopeId: number | null;
  /** For a connection scope this is the id; the page joins it against the catalog it has. */
  scopeName: string;
  roleId: number;
  roleName: string;
  grantedAt: string;
  grantedBy: string | null;
}

export interface GrantRequest {
  subjectType: SubjectType;
  subjectId: number;
  scopeType: ScopeType;
  scopeId?: number | null;
  roleId: number;
}

/** One permission, described by the server so the role editor never holds a stale list. */
export interface PermissionInfo {
  /** What the API calls it, which is what a role request carries. */
  name: string;
  /** The domain:verb form a person reads. */
  id: string;
  /** CONNECTION or INSTANCE — whether it is about a target or about Keydra itself. */
  level: 'CONNECTION' | 'INSTANCE';
}

export type ProviderKind = 'OIDC' | 'OAUTH2';

/** A configured identity provider, as an administrator sees it. */
export interface ProviderSummary {
  id: number;
  key: string;
  displayName: string;
  kind: ProviderKind;
  enabled: boolean;
  sortOrder: number;
  issuer: string | null;
  clientId: string;
  /** Whether a secret is stored. The secret itself never leaves the server. */
  hasClientSecret: boolean;
  scopes: string;
  authorizationEndpoint: string | null;
  tokenEndpoint: string | null;
  userInfoEndpoint: string | null;
  /** Whether Keydra knows where to send people — the first question when a sign-in fails. */
  endpointsDiscovered: boolean;
  subjectClaim: string;
  usernameClaim: string;
  emailClaim: string | null;
  nameClaim: string | null;
  groupsClaim: string | null;
  autoCreateUsers: boolean;
  /** What the provider has to be told, to the character. */
  redirectUri: string;
  groupMappings: GroupMappingSummary[];
}

export interface GroupMappingSummary {
  id: number;
  claimValue: string;
  groupId: number;
  groupName: string;
}
