import type { PubSubCallback } from './types';

/**
 * Creates a publish-subscribe system for event-driven communication.
 * Supports topic patterns with wildcards for flexible event matching.
 *
 * @returns An object with methods to subscribe, publish, and manage event topics
 * @example
 * ```typescript
 * const pubsub = createPubSub();
 *
 * // Subscribe to specific event
 * pubsub.subscribe('user:login', (event, data) => {
 *   console.log(`User logged in: ${data.userId}`);
 * });
 *
 * // Subscribe with wildcard pattern
 * pubsub.subscribe('user:*', (event, data) => {
 *   console.log(`User event: ${event}`);
 * });
 *
 * // Publish an event
 * await pubsub.publish('user:login', { userId: '123' });
 * ```
 */
export const createPubSub = () => {
  const subscribers = new Map<string, Set<PubSubCallback>>();

  const subscribe = (topic: string, callback: PubSubCallback) => {
    if (!subscribers.has(topic)) {
      subscribers.set(topic, new Set());
    }
    subscribers.get(topic)?.add(callback);

    return () => {
      const topicSubscribers = subscribers.get(topic);
      if (topicSubscribers) {
        topicSubscribers.delete(callback);
        if (topicSubscribers.size === 0) {
          subscribers.delete(topic);
        }
      }
    };
  };

  const unsubscribe = (topic: string, callback: PubSubCallback) => {
    const topicSubscribers = subscribers.get(topic);
    if (topicSubscribers) {
      topicSubscribers.delete(callback);
      if (topicSubscribers.size === 0) {
        subscribers.delete(topic);
      }
    }
  };

  const publish = async (event: string, data?: any) => {
    const matchingSubscribers = new Set<PubSubCallback>();

    for (const [topic, callbacks] of subscribers.entries()) {
      if (matchesPattern(event, topic)) {
        for (const callback of callbacks) {
          matchingSubscribers.add(callback);
        }
      }
    }

    const promises = Array.from(matchingSubscribers).map(async (callback) => {
      try {
        await callback(event, data);
      } catch (error) {
        console.error(`Error in pub/sub callback for event ${event}:`, error);
      }
    });

    await Promise.allSettled(promises);
  };

  const getSubscriberCount = (topic?: string): number => {
    if (!topic) {
      return Array.from(subscribers.values()).reduce(
        (total, set) => total + set.size,
        0
      );
    }
    return subscribers.get(topic)?.size || 0;
  };

  const getTopics = (): string[] => {
    return Array.from(subscribers.keys());
  };

  return {
    subscribe,
    unsubscribe,
    publish,
    getSubscriberCount,
    getTopics,
  };
};

const matchesPattern = (event: string, pattern: string): boolean => {
  if (pattern === event) {
    return true;
  }

  if (pattern.includes('*')) {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except *
      .replace(/\*/g, '.*'); // Replace * with .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(event);
  }

  return false;
};
