import { generateKeyBetween } from "fractional-indexing";

// Fractional/lexicographic ranks: a move is a single-row rank update between two
// neighbors, never a sibling renumber -> no two-writer reindex race (finding H2).

export function rankAtEnd(last: string | null): string {
  return generateKeyBetween(last, null);
}

export function rankBetween(prev: string | null, next: string | null): string {
  return generateKeyBetween(prev, next);
}
