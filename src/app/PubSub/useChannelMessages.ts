import { useContext, useEffect, useRef, useState } from 'react';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import type { ChannelMessagePayload, ReceivedMessage } from './types';

/**
 * How many messages the feed keeps.
 *
 * <p>A busy channel publishes faster than anyone reads. Without a ceiling the tab accumulates every
 * message ever seen until it runs out of memory — the same failure the key list was capped to
 * avoid, arriving from a different direction.
 */
export const MAX_MESSAGES = 500;

export interface ChannelFeed {
  messages: ReceivedMessage[];
  clear: () => void;
}

/**
 * Collects messages arriving for one connection.
 *
 * <p>They come over the notification hub rather than a socket of their own, so a subscription is
 * shared: two tabs watching the same target both see everything, and neither holds a connection
 * open on its own.
 */
export const useChannelMessages = (connectionId: number): ChannelFeed => {
  const { notifications } = useContext(ServiceContext);
  const [messages, setMessages] = useState<ReceivedMessage[]>([]);
  const [feedFor, setFeedFor] = useState(connectionId);
  // A counter, not a timestamp: two messages in the same millisecond must not share a key.
  const nextId = useRef(0);

  // Another target's messages are not this feed's. Cleared during render so the old
  // ones are never shown under the new target's name.
  if (feedFor !== connectionId) {
    setFeedFor(connectionId);
    setMessages([]);
  }

  useEffect(() => {
    return notifications.subscribe<ChannelMessagePayload>(
      NotificationCategory.ChannelMessage,
      ({ payload }) => {
        if (payload.connectionId !== connectionId) {
          return;
        }
        nextId.current += 1;
        const received: ReceivedMessage = {
          ...payload,
          id: `message-${nextId.current}`,
          at: new Date(),
        };
        // Newest first, and never more than the cap.
        setMessages((current) => [received, ...current].slice(0, MAX_MESSAGES));
      },
    );
  }, [connectionId, notifications]);

  return { messages, clear: () => setMessages([]) };
};
