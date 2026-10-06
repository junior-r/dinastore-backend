import { User } from '@/modules/users/domain/entities/user.entity';

// Published on every new-account creation (password registration or a
// brand-new OAuth signup) so listeners outside the Users module -- e.g.
// RealtimeModule pushing a live notification to admins watching the users
// list -- don't need a direct dependency on Users' command handlers.
export class UserRegisteredEvent {
  constructor(public readonly user: User) {}
}
