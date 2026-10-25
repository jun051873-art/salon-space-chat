// Keep the launch cover visible until the first screen has finished rendering.
export function releaseCoverAfter(rendered, cover, isCurrent = () => true) {
  return Promise.resolve(rendered)
    .catch(() => undefined)
    .then(value => {
      if (cover?.isConnected && isCurrent()) cover.remove();
      return value;
    });
}
