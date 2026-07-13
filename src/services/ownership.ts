import { DomainError } from "../domain/errors";

// Resource scoping: missing row -> 404; row owned by another user -> 403.
export function assertOwned(
  row: { userId: string } | undefined | null,
  userId: string,
): asserts row is { userId: string } {
  if (!row) throw new DomainError("NOT_FOUND", 404);
  if (row.userId !== userId) throw new DomainError("FORBIDDEN", 403);
}
