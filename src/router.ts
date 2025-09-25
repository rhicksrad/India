export type Route = 'cancer' | 'cuisine' | 'compare';

const validRoutes: Route[] = ['cancer', 'cuisine', 'compare'];

function normalizeHash(hash: string | null): Route {
  const clean = (hash ?? '').replace(/^#/, '').toLowerCase();
  if (validRoutes.includes(clean as Route)) {
    return clean as Route;
  }
  return 'cancer';
}

export function initRouter(onRouteChange: (route: Route) => void) {
  const handle = () => onRouteChange(normalizeHash(window.location.hash));
  window.addEventListener('hashchange', handle);
  handle();
  return () => window.removeEventListener('hashchange', handle);
}

export function navigate(route: Route) {
  if (window.location.hash.replace(/^#/, '') === route) return;
  window.location.hash = route;
}
