// Finished reviews are kept in this browser so reopening one is instant.
// Only the PGN and raw engine output are stored; the review is rebuilt from them.
import type { PositionAnalysis } from './analysis/types';

export interface HistoryEntry {
  id: string;
  title: string;
  accuracy: string;
  date: number;
  depth: number;
  pgn: string;
  /** The player whose account the game came from, if any. */
  me?: string;
  positions: PositionAnalysis[];
}

const KEY = 'chess-analyzer:reviews';
const MAX = 25;

export function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]) {
  let list = entries.slice(0, MAX);
  // Drop the oldest entries until it fits in the storage quota.
  while (list.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return;
    } catch {
      list = list.slice(0, -1);
    }
  }
}
