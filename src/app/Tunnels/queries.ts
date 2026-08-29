import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';
import type { TunnelCheck, TunnelRequest, TunnelSummary } from './types';

export const tunnelsQueryKey = ['tunnels'] as const;

const useInvalidateTunnels = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: tunnelsQueryKey });
};

/** The fields a jump host is drawn with. Named here so the query and the table cannot drift. */
const TUNNEL_FIELDS = `
  id
  name
  host
  port
  username
  hasPassword
  hasPrivateKey
  verifiesHostKey
  hostKeyFingerprint
  describedAs
  usedBy
`;

const LIST = `
  query Tunnels {
    tunnels {
      ${TUNNEL_FIELDS}
    }
  }
`;

/**
 * Every configured jump host.
 *
 * <p>Read by the connection form and the destination form as well as by the page that manages
 * them: both have to offer the choice, and the list is what the choice is made from.
 */
export const useTunnels = (): UseQueryResult<TunnelSummary[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...tunnelsQueryKey, 'list'],
    queryFn: () =>
      graphql.query<{ tunnels: TunnelSummary[] }>(LIST).then((answer) => answer.tunnels),
    // Describing a tunnel is an administrator's job; somebody who may only edit a target
    // still needs the list to choose from, and gets an empty one rather than an error.
    retry: false,
  });
};

const CREATE = `
  mutation CreateTunnel($tunnel: TunnelRequestInput) {
    createTunnel(tunnel: $tunnel) {
      ${TUNNEL_FIELDS}
    }
  }
`;

const UPDATE = `
  mutation UpdateTunnel($id: BigInteger, $tunnel: TunnelRequestInput) {
    updateTunnel(id: $id, tunnel: $tunnel) {
      ${TUNNEL_FIELDS}
    }
  }
`;

export const useSaveTunnel = (): UseMutationResult<
  TunnelSummary,
  Error,
  { id?: number; request: TunnelRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateTunnels();
  return useMutation({
    mutationFn: ({ id, request }) =>
      id === undefined
        ? graphql
            .query<{ createTunnel: TunnelSummary }>(CREATE, { tunnel: request })
            .then((answer) => answer.createTunnel)
        : graphql
            .query<{ updateTunnel: TunnelSummary }>(UPDATE, { id, tunnel: request })
            .then((answer) => answer.updateTunnel),
    onSuccess: invalidate,
  });
};

const DELETE = `
  mutation DeleteTunnel($id: BigInteger) {
    deleteTunnel(id: $id)
  }
`;

export const useDeleteTunnel = (): UseMutationResult<boolean, Error, number> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateTunnels();
  return useMutation({
    mutationFn: (id: number) =>
      graphql
        .query<{ deleteTunnel: boolean }>(DELETE, { id })
        .then((answer) => answer.deleteTunnel),
    onSuccess: invalidate,
  });
};

const CHECK = `
  mutation CheckTunnel($id: BigInteger, $tunnel: TunnelRequestInput) {
    checkTunnel(id: $id, tunnel: $tunnel) {
      reachable
      message
      fingerprint
    }
  }
`;

/**
 * Connects, authenticates, and answers the key it was presented — working or not.
 *
 * <p>One operation for both the saved jump host and the one being edited, which is what the server
 * offers: the id says which stored secrets to fall back on, and the request says what to try. An
 * edit form never carries stored secrets back, so without the id every test of an unchanged
 * password would fail for a reason that has nothing to do with the jump host.
 */
export const useCheckTunnel = (): UseMutationResult<TunnelCheck, Error, number> => {
  const { graphql } = useContext(ServiceContext);
  return useMutation({
    // No tunnel alongside the id: the saved one, exactly as it is. A row with a test button
    // beside it is asking about what it is already looking at.
    mutationFn: (id: number) =>
      graphql
        .query<{ checkTunnel: TunnelCheck }>(CHECK, { id, tunnel: null })
        .then((answer) => answer.checkTunnel),
  });
};

/**
 * The same attempt, against a jump host nobody has saved yet.
 *
 * <p>The id of the tunnel being edited goes with it when there is one: an edit form never carries
 * the stored secrets back, so without it every test of an unchanged password would fail for a
 * reason that has nothing to do with the jump host.
 */
export const useCheckTunnelDraft = (): UseMutationResult<
  TunnelCheck,
  Error,
  { id?: number; request: TunnelRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  return useMutation({
    mutationFn: ({ id, request }) =>
      graphql
        .query<{ checkTunnel: TunnelCheck }>(CHECK, { id: id ?? null, tunnel: request })
        .then((answer) => answer.checkTunnel),
  });
};
