export class UpdateUserPermissionsCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly permissions: string[],
  ) {}
}
