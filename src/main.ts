import { loadAppData, type AppData } from './data/load';
import { initRouter, navigate, type Route } from './router';
import { renderCancerView } from './ui/viewCancer';
import { renderCuisineView } from './ui/viewCuisine';
import { renderCompareView } from './ui/viewCompare';
import './ui/app.css';

const NAV_ITEMS: Array<{ route: Route; label: string }> = [
  { route: 'cancer', label: 'Cancer' },
  { route: 'cuisine', label: 'Cuisine' },
  { route: 'compare', label: 'Compare' }
];

async function main() {
  const navEl = document.getElementById('nav');
  const appEl = document.getElementById('app');
  if (!navEl || !appEl) return;

  appEl.innerHTML = '<p class="status">Loading data…</p>';

  let data: AppData;
  try {
    data = await loadAppData();
  } catch (err) {
    console.error(err);
    appEl.innerHTML = '<p class="status error">Failed to load data. Check console for details.</p>';
    return;
  }

  navEl.innerHTML = NAV_ITEMS.map((item) => `<button class="nav-item" data-route="${item.route}">${item.label}</button>`).join('');

  navEl.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('nav-item')) {
      const route = target.dataset.route as Route | undefined;
      if (route) navigate(route);
    }
  });

  const navButtons = Array.from(navEl.querySelectorAll<HTMLButtonElement>('.nav-item'));

  const renderRoute = (route: Route) => {
    navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.route === route));
    switch (route) {
      case 'cancer':
        renderCancerView(appEl, data);
        break;
      case 'cuisine':
        renderCuisineView(appEl, data);
        break;
      case 'compare':
        renderCompareView(appEl, data);
        break;
      default:
        renderCancerView(appEl, data);
    }
  };

  initRouter(renderRoute);
}

main();
