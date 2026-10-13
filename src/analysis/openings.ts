// Opening book built from the Lichess chess-openings dataset (CC0), see scripts/build-openings.mjs.
// Maps the first four FEN fields to the opening name ('' for unnamed book positions).
type Book = Record<string, string>;

let book: Promise<Book> | undefined;

export function loadBook(): Promise<Book> {
  book ??= import('../data/openings.json').then((m) => m.default as Book);
  return book;
}

export const bookKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
