import type { GraphQLService } from '@app/Shared/Services/GraphQL.service';
import type { PublishResult, Subscription, SubscriptionRequest } from './types';

const SUBSCRIPTION_FIELDS = `
  connectionId
  channels
  patterns
  since
  messagesReceived
`;

const documents = {
  current: `
    query PubSubSubscription($connectionId: BigInteger) {
      subscription(connectionId: $connectionId) {
        ${SUBSCRIPTION_FIELDS}
      }
    }
  `,
  subscribe: `
    mutation Subscribe($connectionId: BigInteger, $subscription: SubscriptionRequestInput) {
      subscribe(connectionId: $connectionId, subscription: $subscription) {
        ${SUBSCRIPTION_FIELDS}
      }
    }
  `,
  unsubscribe: `
    mutation Unsubscribe($connectionId: BigInteger) {
      unsubscribe(connectionId: $connectionId)
    }
  `,
  publish: `
    mutation Publish($connectionId: BigInteger, $channel: String, $payload: String) {
      publish(connectionId: $connectionId, channel: $channel, payload: $payload) {
        receivers
      }
    }
  `,
};

/**
 * The standing arrangement, and the two things that change it.
 *
 * <p>The messages themselves never come through here — they arrive on the notification hub as they
 * are published, which is what a socket is for and what an answer to a question cannot be.
 */
export const pubSubApi = {
  subscription: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ subscription: Subscription | null }>(documents.current, { connectionId })
      .then((a) => a.subscription),

  subscribe: (graphql: GraphQLService, connectionId: number, request: SubscriptionRequest) =>
    graphql
      .query<{ subscribe: Subscription }>(documents.subscribe, {
        connectionId,
        subscription: request,
      })
      .then((a) => a.subscribe),

  unsubscribe: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ unsubscribe: boolean }>(documents.unsubscribe, { connectionId })
      .then((a) => a.unsubscribe),

  publish: (graphql: GraphQLService, connectionId: number, channel: string, payload: string) =>
    graphql
      .query<{ publish: PublishResult }>(documents.publish, { connectionId, channel, payload })
      .then((a) => a.publish),
};
