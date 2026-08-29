import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type {
  ConnectionRequest,
  ConnectionResponse,
  ConnectionStatus,
} from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { useConnectionNotifications } from './useConnectionNotifications';

export const connectionsQueryKey = ['connections'] as const;

/** The fields a target is drawn with. Named once so the queries cannot drift apart. */
const CONNECTION_FIELDS = `
  id
  name
  type
  engine
  host
  port
  username
  hasPassword
  hasClientKey
  hasClientKeyPassphrase
  consoleAllowed
  guarded
  database
  tls
  tlsCaCert
  tlsClientCert
  notes
  sentinelMasterName
  namespace
  tunnelId
  flavor
  status {
    state
    message
    checkedAt
    server {
      version
      mode
      flavor
    }
  }
`;

const LIST = `
  query Connections {
    connections {
      ${CONNECTION_FIELDS}
    }
  }
`;

/**
 * Server state for the connections list.
 *
 * <p>Kept current here rather than by each page that shows a status. Everything reads a profile out
 * of this one cached list — the list, the overview, a target's own page — so a page that forgot to
 * subscribe showed whatever the status was when it loaded: "connecting", for a target being probed
 * as the page opened, and it stayed there. Subscribing where the data is read means there is
 * nothing left to forget.
 */
export const useConnections = (): UseQueryResult<ConnectionResponse[]> => {
  const { graphql } = useContext(ServiceContext);
  useConnectionNotifications();
  return useQuery({
    queryKey: connectionsQueryKey,
    queryFn: () =>
      graphql.query<{ connections: ConnectionResponse[] }>(LIST).then((a) => a.connections),
  });
};

const CREATE = `
  mutation CreateConnection($connection: ConnectionRequestInput) {
    createConnection(connection: $connection) {
      ${CONNECTION_FIELDS}
    }
  }
`;

export const useCreateConnection = (): UseMutationResult<
  ConnectionResponse,
  Error,
  ConnectionRequest
> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ConnectionRequest) =>
      graphql
        .query<{ createConnection: ConnectionResponse }>(CREATE, { connection: body })
        .then((a) => a.createConnection),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionsQueryKey }),
  });
};

const UPDATE = `
  mutation UpdateConnection($id: BigInteger, $connection: ConnectionRequestInput) {
    updateConnection(id: $id, connection: $connection) {
      ${CONNECTION_FIELDS}
    }
  }
`;

export const useUpdateConnection = (): UseMutationResult<
  ConnectionResponse,
  Error,
  { id: number; body: ConnectionRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ConnectionRequest }) =>
      graphql
        .query<{ updateConnection: ConnectionResponse }>(UPDATE, { id, connection: body })
        .then((a) => a.updateConnection),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionsQueryKey }),
  });
};

const DELETE = `
  mutation DeleteConnection($id: BigInteger) {
    deleteConnection(id: $id)
  }
`;

export const useDeleteConnection = (): UseMutationResult<boolean, Error, number> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      graphql.query<{ deleteConnection: boolean }>(DELETE, { id }).then((a) => a.deleteConnection),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionsQueryKey }),
  });
};

const CHECK = `
  mutation CheckConnection($id: BigInteger, $connection: ConnectionRequestInput) {
    checkConnection(id: $id, connection: $connection) {
      state
      message
      checkedAt
      server {
        version
        mode
        flavor
      }
    }
  }
`;

export const useTestConnection = (): UseMutationResult<ConnectionStatus, Error, number> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    // No profile alongside the id: the saved one, exactly as it is.
    mutationFn: (id: number) =>
      graphql
        .query<{ checkConnection: ConnectionStatus }>(CHECK, { id, connection: null })
        .then((a) => a.checkConnection),
    // The probe updates the profile's tracked status server-side, so the list is stale.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionsQueryKey }),
  });
};

/**
 * The same probe, against a profile nobody has saved yet.
 *
 * <p>Records nothing — a target's tracked status is not a form's to change — and carries the id
 * when there is one, because an edit sends no password it did not change.
 */
export const useTestConnectionDraft = (): UseMutationResult<
  ConnectionStatus,
  Error,
  { id?: number; request: ConnectionRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  return useMutation({
    mutationFn: ({ id, request }) =>
      graphql
        .query<{ checkConnection: ConnectionStatus }>(CHECK, {
          id: id ?? null,
          connection: request,
        })
        .then((a) => a.checkConnection),
  });
};

/**
 * One saved profile, taken from the list rather than fetched on its own.
 *
 * <p>The list is already cached and kept current by the notification hub, so a per-profile
 * endpoint would only add a request whose answer can disagree with what is on screen.
 */
export const useConnection = (id: number | undefined): ConnectionResponse | undefined => {
  const { data } = useConnections();
  return id === undefined ? undefined : data?.find((profile) => profile.id === id);
};
