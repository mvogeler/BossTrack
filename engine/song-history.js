export function createSongHistory(limit = 24) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid history limit');
  const past = [], future = [];
  const copy = value => structuredClone(value);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const push = (list, value) => {
    if (!list.length || !same(list.at(-1), value)) list.push(copy(value));
    if (list.length > limit) list.shift();
  };
  const move = (from, to, current) => {
    while (from.length && same(from.at(-1), current)) from.pop();
    if (!from.length) return null;
    push(to, current);
    return copy(from.pop());
  };
  return {
    record(snapshot) { push(past, snapshot); future.length = 0; },
    undo(current) { return move(past, future, current); },
    redo(current) { return move(future, past, current); },
    clear() { past.length = 0; future.length = 0; },
    canUndo() { return past.length > 0; },
    canRedo() { return future.length > 0; },
  };
}
