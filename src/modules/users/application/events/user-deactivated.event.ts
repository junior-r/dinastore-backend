// Published when an admin deactivates an account, so listeners outside the
// Users module -- e.g. RealtimeModule ending that user's live session -- can
// react without a direct dependency on Users' command handlers.
export class UserDeactivatedEvent {
  constructor(public readonly userId: string) {}
}
