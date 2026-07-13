// Per-request context shared by REST and MCP. `now`/`newId` are injected so the
// service layer stays deterministic under test.
export interface AppContext {
  userId: string;
  timeZone: string;
  gateEnabled: boolean;
  now(): number;
  newId(): string;
}

export function createContext(opts: {
  userId: string;
  timeZone: string;
  gateEnabled: boolean;
}): AppContext {
  return {
    ...opts,
    now: () => Date.now(),
    newId: () => crypto.randomUUID(),
  };
}
