import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';

// Keep the loaded grid for Back/Forward navigation; a fresh visit still shuffles.
const historyGrids = new Map<string, { grid: string; loader: string; page: string; pages: string }>();
let cleanup: (() => void) | undefined;

function nameTiles(grid: Element) {
  grid.querySelectorAll<HTMLElement>('[data-asset-id]').forEach(tile => {
    tile.removeAttribute('data-astro-transition-scope');
    tile.style.viewTransitionName = `asset-${tile.dataset.assetId}`;
  });
}

function start() {
  cleanup?.();
  const loader = document.querySelector<HTMLElement>('[data-library-loader]');
  const grid = document.querySelector<HTMLElement>('.wrapper');
  const link = loader?.querySelector<HTMLAnchorElement>('[data-load-more]');
  const status = loader?.querySelector<HTMLElement>('[data-library-status]');
  if (!loader || !grid || !link || !status) return;
  nameTiles(grid);
  const abort = new AbortController();
  let busy = false;
  let failed = false;
  let observer: IntersectionObserver | undefined;
  const seen = new Set([...grid.querySelectorAll<HTMLElement>('[data-asset-id]')].map(el => el.dataset.assetId));
  const finished = () => Number(loader.dataset.page) >= Number(loader.dataset.pages);
  const nearBottom = () => loader.getBoundingClientRect().top < innerHeight + 600;

  async function load() {
    if (busy || finished() || abort.signal.aborted) return;
    busy = true;
    failed = false;
    loader!.setAttribute('aria-busy','true');
    status!.textContent = 'Loading more assets…';
    link!.hidden = true;
    try {
      const response = await fetch(link!.href, { signal: abort.signal });
      if (!response.ok) throw new Error('Library unavailable');
      const next = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextLoader = next.querySelector<HTMLElement>('[data-library-loader]');
      const nextGrid = next.querySelector('.wrapper');
      if (!nextLoader || !nextGrid || Number(nextLoader.dataset.page) !== Number(loader!.dataset.page) + 1) {
        throw new Error('Invalid library page');
      }
      if (abort.signal.aborted) return;
      nameTiles(nextGrid);
      const fragment = document.createDocumentFragment();
      nextGrid.querySelectorAll<HTMLElement>('[data-asset-id]').forEach(tile => {
        if (!seen.has(tile.dataset.assetId)) {
          seen.add(tile.dataset.assetId);
          fragment.append(tile);
        }
      });
      grid!.append(fragment);
      loader!.dataset.page = nextLoader.dataset.page;
      loader!.dataset.pages = nextLoader.dataset.pages;
      link!.href = nextLoader.querySelector<HTMLAnchorElement>('[data-load-more]')!.href;
      link!.textContent = 'Load more assets';
      status!.textContent = finished() ? 'You’ve reached the end of the library.' : '';
      if (finished()) observer?.disconnect();
    } catch {
      if (abort.signal.aborted) return;
      failed = true;
      status!.textContent = 'Couldn’t load more assets. Please try again.';
      link!.textContent = 'Try again';
    } finally {
      busy = false;
      loader!.removeAttribute('aria-busy');
      if (!abort.signal.aborted) {
        link!.hidden = finished();
        if (!failed && !finished() && nearBottom()) void load();
      }
    }
  }

  const clicked = (event: MouseEvent) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void load();
  };
  link.addEventListener('click', clicked);
  if ('IntersectionObserver' in window && !finished()) {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !failed) void load();
    }, { rootMargin: '600px' });
    observer.observe(loader);
  }
  cleanup = () => {
    abort.abort();
    observer?.disconnect();
    link.removeEventListener('click', clicked);
  };
}

document.addEventListener('astro:before-swap', event => {
  cleanup?.();
  cleanup = undefined;
  const swap = event as TransitionBeforeSwapEvent;
  const grid = document.querySelector('.wrapper');
  const loader = document.querySelector<HTMLElement>('[data-library-loader]');
  if (grid && loader) {
    // An interrupted request resumes from the last completed batch.
    loader.removeAttribute('aria-busy');
    const link = loader.querySelector<HTMLAnchorElement>('[data-load-more]');
    if (link) link.hidden = Number(loader.dataset.page) >= Number(loader.dataset.pages);
    const status = loader.querySelector<HTMLElement>('[data-library-status]');
    if (status?.textContent === 'Loading more assets…') status.textContent = '';
    historyGrids.set(swap.from.href, { grid: grid.innerHTML, loader: loader.innerHTML, page: loader.dataset.page!, pages: loader.dataset.pages! });
    if (historyGrids.size > 3) historyGrids.delete(historyGrids.keys().next().value!);
  }
  const cached = swap.navigationType === 'traverse' ? historyGrids.get(swap.to.href) : undefined;
  const incomingGrid = swap.newDocument.querySelector('.wrapper');
  const incomingLoader = swap.newDocument.querySelector<HTMLElement>('[data-library-loader]');
  if (cached && incomingGrid && incomingLoader) {
    incomingGrid.innerHTML = cached.grid;
    incomingLoader.innerHTML = cached.loader;
    incomingLoader.dataset.page = cached.page;
    incomingLoader.dataset.pages = cached.pages;
  }
});
document.addEventListener('astro:page-load', start);
