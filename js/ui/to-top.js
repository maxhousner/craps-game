// "Back to top" link for the long pages: appears once the header with the page tabs has scrolled away.
export function initToTop(link) {
  let queued = false;
  const update = () => {
    queued = false;
    link.hidden = scrollY < innerHeight * 0.75;
  };
  addEventListener('scroll', () => {
    if (!queued) requestAnimationFrame(update);
    queued = true;
  }, { passive: true });
  update();
}
