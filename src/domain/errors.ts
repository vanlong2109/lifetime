export type DomainErrorCode =
  | "DOD_INCOMPLETE"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT";

// Transport-agnostic error carrying an HTTP status. REST maps it to a response;
// MCP maps it to a tool error. Never leak internals through `message`.
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    public readonly httpStatus: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "DomainError";
  }
}
