/** Wire types for pub/sub, mirroring io.keydra.pubsub.dto. */

export interface Subscription {
  connectionId: number;
  channels: string[];
  patterns: string[];
  since: string;
  messagesReceived: number;
}

export interface SubscriptionRequest {
  channels: string[];
  patterns: string[];
}

export interface PublishResult {
  receivers: number;
}

/** A message as it arrives over the notification hub. */
export interface ChannelMessagePayload {
  connectionId: number;
  channel: string;
  /** Empty when the subscription named the channel rather than matching a pattern. */
  pattern: string;
  payload: string;
}

/** One received message, with the moment it landed. */
export interface ReceivedMessage extends ChannelMessagePayload {
  id: string;
  at: Date;
}
