export class DeactivateUserCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly targetUserId: string,
  ) {}
}
