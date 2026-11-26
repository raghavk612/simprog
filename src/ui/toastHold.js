// Notifications that wait while a game is live, so nothing covers the score, the drawers or the controls at the moment
// that matters. toast.js offers every notification here and shows what is released at the next quarter break or when
// the game ends. Errors, and notifications marked `now` (the answer to something the coach just did), never wait.
// No DOM here, so tests can check it.
export class ToastHold {
  // max: how many wait at most (the toast stack shows three at a time); the oldest go first.
  constructor(max = 3) {
    this.max = max;
    this.held = [];
  }
  get size() {
    return this.held.length;
  }
  // true: show it now; false: it waits.
  offer(item, live) {
    if (!live || item.opt?.type === 'error' || item.opt?.now) return true;
    this.held.push(item);
    if (this.held.length > this.max) this.held.splice(0, this.held.length - this.max);
    return false;
  }
  release() {
    const out = this.held;
    this.held = [];
    return out;
  }
}
