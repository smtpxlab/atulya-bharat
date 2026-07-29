import { EventEmitter } from "node:events";

/**
 * Application-level event bus. Domain events (e.g. `activity.logged`,
 * `registration.created`) are published here; realtime + queue listeners
 * subscribe in later phases.
 */
export const appEvents = new EventEmitter();
appEvents.setMaxListeners(50);

export type AppEventName =
  | "activity.logged"
  | "registration.created"
  | "milestone.unlocked"
  | "order.paid";
