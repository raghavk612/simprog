// What render() (shell.js) carries across a redraw that lives only in the DOM, as pure helpers over element-like
// objects ({ className, scrollLeft, ... }), so tests run without a browser. Open <details> and the sideways scroll of
// each table (.table-wrap: a phone shows a few columns at a time) are found again by their classes and their place
// among elements with the same classes.

export function nthKeys(els) {
  const seen = {};
  return [...els].map(el => {
    const k = el.className;
    seen[k] = (seen[k] ?? -1) + 1;
    return { el, key: `${k}#${seen[k]}` };
  });
}
// The tables scrolled sideways, by key.
export const sideScroll = els =>
  new Map(
    nthKeys(els)
      .filter(x => x.el.scrollLeft)
      .map(x => [x.key, x.el.scrollLeft]),
  );
export function restoreSideScroll(els, saved) {
  for (const { el, key } of nthKeys(els)) if (saved.has(key)) el.scrollLeft = saved.get(key);
}
