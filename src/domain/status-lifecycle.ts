import { DomainError } from "./errors";
import type { TaskStatus } from "./schemas";

// Empty DoD counts as complete (nothing to gate).
export function isDodComplete(dod: ReadonlyArray<{ done: boolean }>): boolean {
  return dod.every((d) => d.done);
}

// DoD-gate: block a transition into `done` while the gate is enabled and any
// criterion is unmet (finding H3).
export function assertDodComplete(
  dod: ReadonlyArray<{ done: boolean }>,
  gateEnabled: boolean,
): void {
  if (gateEnabled && !isDodComplete(dod)) {
    throw new DomainError(
      "DOD_INCOMPLETE",
      422,
      "Definition of Done is incomplete",
    );
  }
}

export interface StatusResult {
  status: TaskStatus;
  completedAt: number | null;
}

// Set completedAt when entering `done`, clear when leaving; preserve it on a
// done->done no-op edit.
export function applyStatusTransition(
  prev: TaskStatus,
  next: TaskStatus,
  now: number,
  prevCompletedAt: number | null = null,
): StatusResult {
  if (next === "done") {
    return {
      status: "done",
      completedAt: prev === "done" ? (prevCompletedAt ?? now) : now,
    };
  }
  return { status: next, completedAt: null };
}

// H3: preserve the invariant "done => DoD complete" (when gated). If a done
// task's DoD becomes incomplete (criterion toggled off or a new one added),
// auto-revert to `doing` and clear completedAt. Call after every DoD mutation.
export function reconcileOnChildChange(
  task: { status: TaskStatus; completedAt: number | null },
  dod: ReadonlyArray<{ done: boolean }>,
  gateEnabled: boolean,
): StatusResult {
  if (gateEnabled && task.status === "done" && !isDodComplete(dod)) {
    return { status: "doing", completedAt: null };
  }
  return { status: task.status, completedAt: task.completedAt };
}
