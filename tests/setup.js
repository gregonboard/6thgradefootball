/*
 * Node 22+ ships an experimental `localStorage` global that is undefined unless
 * node runs with --localstorage-file. Vitest's jsdom environment skips copying
 * jsdom's working localStorage over that existing global, so tests see undefined.
 * Install a spec-shaped in-memory Storage so the suite runs the same everywhere.
 */
function makeStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    key(i) {
      return [...store.keys()][i] ?? null;
    },
    getItem(k) {
      k = String(k);
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(String(k), String(v));
    },
    removeItem(k) {
      store.delete(String(k));
    },
    clear() {
      store.clear();
    },
  };
}

for (const name of ["localStorage", "sessionStorage"]) {
  Object.defineProperty(globalThis, name, {
    value: makeStorage(),
    writable: true,
    configurable: true,
  });
}
