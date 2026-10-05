import { DomainEvent, EventHandler } from './types';

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private outboxRecorder?: (event: DomainEvent) => Promise<void>;

  setOutboxRecorder(recorder: (event: DomainEvent) => Promise<void>) {
    this.outboxRecorder = recorder;
  }

  subscribe(eventName: string, handler: EventHandler): () => void {
    const list = this.handlers.get(eventName) || [];
    list.push(handler);
    this.handlers.set(eventName, list);

    return () => {
      const current = this.handlers.get(eventName) || [];
      this.handlers.set(
        eventName,
        current.filter((h) => h !== handler)
      );
    };
  }

  async publish<T = any>(event: DomainEvent<T>): Promise<void> {
    if (this.outboxRecorder) {
      try {
        await this.outboxRecorder(event);
      } catch (err) {
        console.error(`Failed to record outbox event ${event.name}:`, err);
      }
    }

    const listeners = this.handlers.get(event.name) || [];
    for (const handler of listeners) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.name}:`, error);
      }
    }
  }

  clear() {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
