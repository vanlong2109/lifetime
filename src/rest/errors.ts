import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { DomainError } from "../domain/errors";

// Structural shape shared by zod v3 ZodError and zod v4 $ZodError (the hook
// receives the v4 variant). Kept minimal so the hook stays version-agnostic.
interface IssueBag {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
}

// zValidator hook: on failure return 422 with a safe issue list (path + message
// only — never raw internals). Reused across all validated routes.
export function validationHook(
  result: { success: boolean; error?: IssueBag },
  c: Context,
): Response | undefined {
  if (!result.success && result.error) {
    return c.json(
      {
        code: "VALIDATION",
        issues: result.error.issues.map((i) => ({
          path: i.path.map(String).join("."),
          message: i.message,
        })),
      },
      422,
    );
  }
  return undefined;
}

// Central mapper: DomainError -> its status/code; anything else -> a clean 500
// with no SQL/schema/stack leaked (findings M4/SA7).
export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof DomainError) {
    return c.json(
      { code: err.code, message: err.message },
      err.httpStatus as ContentfulStatusCode,
    );
  }
  console.error("Unhandled error:", err);
  return c.json({ code: "INTERNAL" }, 500);
}
