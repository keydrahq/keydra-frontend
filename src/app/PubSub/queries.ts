import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '@app/Shared/Services/Api.service';
import { ServiceContext } from '@app/Shared/Services/Services';
import { pubSubApi } from './api';
import type { PublishResult, Subscription, SubscriptionRequest } from './types';

export const pubSubQueryKey = (connectionId: number) => ['pubsub', connectionId] as const;

/**
 * The open subscription, or null when there is none.
 *
 * <p>404 is the answer "nothing is subscribed", not a failure: showing an error page because a
 * target is not currently being listened to would be wrong.
 */
export const useSubscription = (
  connectionId: number,
): UseQueryResult<Subscription | null, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: pubSubQueryKey(connectionId),
    queryFn: async () => {
      try {
        return await pubSubApi.subscription(graphql, connectionId);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
  });
};

export const useSubscribe = (
  connectionId: number,
): UseMutationResult<Subscription, Error, SubscriptionRequest> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SubscriptionRequest) =>
      pubSubApi.subscribe(graphql, connectionId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pubSubQueryKey(connectionId) }),
  });
};

export const useUnsubscribe = (connectionId: number): UseMutationResult<boolean, Error, void> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pubSubApi.unsubscribe(graphql, connectionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pubSubQueryKey(connectionId) }),
  });
};

export const usePublish = (
  connectionId: number,
): UseMutationResult<PublishResult, Error, { channel: string; payload: string }> => {
  const { graphql } = useContext(ServiceContext);
  return useMutation({
    mutationFn: ({ channel, payload }: { channel: string; payload: string }) =>
      pubSubApi.publish(graphql, connectionId, channel, payload),
  });
};
