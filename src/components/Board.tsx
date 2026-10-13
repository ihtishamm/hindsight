import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Chess, SQUARES } from 'chess.js';
import { useEffect, useRef } from 'react';
import { BadgeLayer, type KingBadge } from './GameEndBadges';

interface Props {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: [string, string];
  shapes: DrawShape[];
  /** Allow the user to play moves (exploration). */
  interactive: boolean;
  onMove: (from: string, to: string, promotion?: string) => void;
  /** Game-over badges on the kings. */
  badges?: KingBadge[];
}

function legalDests(fen: string): Map<Key, Key[]> {
  const chess = new Chess(fen);
  const dests = new Map<Key, Key[]>();
  for (const s of SQUARES) {
    const ms = chess.moves({ square: s, verbose: true });
    if (ms.length) dests.set(s, ms.map((m) => m.to));
  }
  return dests;
}

export function Board({ fen, orientation, lastMove, shapes, interactive, onMove, badges = [] }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api>(undefined);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    api.current = Chessground(el.current!, {
      animation: { enabled: !matchMedia('(prefers-reduced-motion: reduce)').matches, duration: 220 },
      highlight: { lastMove: true, check: true },
      coordinates: true,
      drawable: { enabled: true, visible: true, defaultSnapToValidMove: true },
      premovable: { enabled: false },
    });
    return () => api.current?.destroy();
  }, []);

  useEffect(() => {
    const chess = new Chess(fen);
    const turn = chess.turn() === 'w' ? 'white' : 'black';
    const config: Config = {
      fen,
      orientation,
      turnColor: turn,
      lastMove: lastMove as Key[] | undefined,
      check: chess.inCheck() ? turn : false,
      movable: {
        free: false,
        color: interactive ? turn : undefined,
        dests: interactive ? legalDests(fen) : new Map(),
        showDests: true,
        events: {
          after: (orig, dest) => {
            const piece = chess.get(orig as never);
            const promotes = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1');
            onMoveRef.current(orig, dest, promotes ? 'q' : undefined);
          },
        },
      },
    };
    api.current?.set(config);
  }, [fen, orientation, lastMove?.[0], lastMove?.[1], interactive]);

  useEffect(() => {
    api.current?.setAutoShapes(shapes);
  }, [shapes]);

  return (
    <div className="board-shell">
      <div ref={el} className="board" />
      {badges.length > 0 && <BadgeLayer badges={badges} orientation={orientation} />}
    </div>
  );
}
