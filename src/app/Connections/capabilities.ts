import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';
import type { Capabilities } from '@app/Topology/types';

const CAPABILITIES = `
  query Capabilities($connectionId: BigInteger) {
    capabilities(connectionId: $connectionId) {
      features
      detected
    }
  }
`;

export const capabilitiesQueryKey = (connectionId: number) =>
  ['connections', connectionId, 'capabilities'] as const;

/**
 * What a target can do, which decides which tools are offered for it.
 *
 * <p>Its own question rather than a corner of the topology answer: the tab bar asks it on every
 * page of a target, and drawing a tab bar should not cost a walk of a cluster's nodes.
 *
 * <p>Held for the session. What a store can do changes when somebody replaces the server, not
 * while a page is open, and re-asking on every navigation would put a request in front of every
 * tab click for an answer that is the same one every time.
 */
export const useCapabilities = (connectionId: number): UseQueryResult<Capabilities, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: capabilitiesQueryKey(connectionId),
    queryFn: () =>
      graphql
        .query<{ capabilities: Capabilities }>(CAPABILITIES, { connectionId })
        .then((answer) => answer.capabilities),
    staleTime: Infinity,
  });
};

/**
 * Whether a target has a capability, while nobody has said otherwise.
 *
 * <p>True until the answer arrives, and true when the answer could not be got. Both are the same
 * decision made twice: hiding a tool from somebody whose target does have it is worse than showing
 * one that turns out not to work, because the second explains itself when they try it and the
 * first looks like the feature was never built.
 */
export const useSupports = (connectionId: number): ((feature?: string) => boolean) => {
  const capabilities = useCapabilities(connectionId);
  return (feature?: string) =>
    !feature || !capabilities.data || capabilities.data.features.includes(feature);
};
