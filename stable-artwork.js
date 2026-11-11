// Keep SVG nodes stable across clicks: DOM serialization expands self-closing paths.
const rendered = new WeakMap();
export function paintArtwork(element, markup) {
  if (!element) return;
  const previous = rendered.get(element);
  if (previous?.markup === markup && previous.node === element.firstChild) return;
  element.innerHTML = markup;
  rendered.set(element, {markup, node: element.firstChild});
}
