import * as d3 from 'd3';
import type { AppData } from '../data/load';
import type { CuisineStateMetrics } from '../data/types';
import { createChoropleth } from '../viz/choropleth';
import { createLegend } from '../viz/legend';

interface MetricOption {
  key: keyof CuisineStateMetrics;
  label: string;
  formatter: (value: number | null) => string;
  description: string;
}

const METRICS: MetricOption[] = [
  { key: 'pct_veg', label: 'Vegetarian share', formatter: formatPct, description: 'Fraction of dishes tagged vegetarian.' },
  { key: 'pct_sweet', label: 'Sweet flavor share', formatter: formatPct, description: 'Dishes with flavor_profile "sweet".' },
  { key: 'pct_lentil_like', label: 'Lentil mention share', formatter: formatPct, description: 'Mentions of lentils or dal variants.' },
  { key: 'pct_red_meat_like', label: 'Red meat mention share', formatter: formatPct, description: 'Mentions of mutton, lamb, pork, or beef.' },
  { key: 'pct_poultry', label: 'Poultry mention share', formatter: formatPct, description: 'Mentions of chicken.' },
  { key: 'pct_fish', label: 'Fish mention share', formatter: formatPct, description: 'Mentions of fish.' },
  { key: 'pct_turmeric', label: 'Turmeric mention share', formatter: formatPct, description: 'Mentions of turmeric/haldi.' },
  { key: 'avg_prep_time', label: 'Average prep time (minutes)', formatter: formatNumber, description: 'Average preparation time across dishes.' },
  { key: 'avg_cook_time', label: 'Average cook time (minutes)', formatter: formatNumber, description: 'Average cook time across dishes.' },
  { key: 'dish_count', label: 'Dish count', formatter: formatNumber, description: 'Number of dishes represented in dataset.' }
];

function formatPct(value: number | null) {
  return value == null ? 'No data' : `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null) {
  if (value == null) return 'No data';
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

export function renderCuisineView(root: HTMLElement, data: AppData) {
  root.innerHTML = '';
  root.className = 'view view-cuisine';

  const layout = document.createElement('div');
  layout.className = 'view-grid';
  const mapContainer = document.createElement('div');
  mapContainer.className = 'map-column';
  const panel = document.createElement('div');
  panel.className = 'panel-column';

  layout.append(mapContainer, panel);
  root.append(layout);

  let currentState: string | null = null;

  const choropleth = createChoropleth({
    container: mapContainer,
    topology: data.topology,
    onHover: (state) => {
      currentState = state;
      renderStateDetail(state);
    }
  });

  panel.innerHTML = `
    <div class="panel-section">
      <label for="cuisine-metric">Metric</label>
      <select id="cuisine-metric" class="control"></select>
      <p class="metric-description"></p>
    </div>
    <div class="panel-section">
      <h3>Legend</h3>
      <div class="legend-container"></div>
    </div>
    <div class="panel-section">
      <h3>Top 5 states</h3>
      <ol class="list top-list"></ol>
    </div>
    <div class="panel-section">
      <h3>State detail</h3>
      <div class="state-detail">Hover a state to inspect cuisine metrics.</div>
    </div>
  `;

  const metricSelect = panel.querySelector<HTMLSelectElement>('#cuisine-metric')!;
  const descriptionEl = panel.querySelector<HTMLParagraphElement>('.metric-description')!;
  METRICS.forEach((metric) => {
    const option = document.createElement('option');
    option.value = metric.key as string;
    option.textContent = metric.label;
    metricSelect.append(option);
  });
  metricSelect.value = 'pct_veg';

  const legend = createLegend({ container: panel.querySelector('.legend-container') as HTMLElement });
  const topList = panel.querySelector<HTMLOListElement>('.top-list')!;
  const detailEl = panel.querySelector<HTMLDivElement>('.state-detail')!;

  const cuisineByState = new Map(data.cuisine.map((row) => [row.state, row]));

  let currentValues = new Map<string, number | null>();
  let currentColorScale: (value: number) => string = () => '#163346';
  const tooltipFormatter = (state: string, value: number | null) => {
    const metric = METRICS.find((m) => m.key === (metricSelect.value as keyof CuisineStateMetrics));
    const row = cuisineByState.get(state);
    const dishCount = row?.dish_count ?? 0;
    return `
      <div class="tooltip-title">${state}</div>
      <div>${metric?.label ?? ''}: ${metric?.formatter(value ?? null)}</div>
      <div>Dishes: ${dishCount}</div>
    `;
  };

  function renderStateDetail(state: string | null) {
    if (!state) {
      detailEl.innerHTML = 'Hover a state to inspect cuisine metrics.';
      return;
    }
    const row = cuisineByState.get(state);
    if (!row) {
      detailEl.innerHTML = `No cuisine data for ${state}.`;
      return;
    }
    const topIngredients = Object.entries(row.ingredient_stats)
      .slice(0, 5)
      .map(([ingredient, count]) => `<li><span>${ingredient}</span><span>${count}</span></li>`)
      .join('');

    const metricItems = METRICS.filter((m) => m.key !== 'dish_count')
      .map((metric) => `<li><span>${metric.label}</span><span>${metric.formatter(row[metric.key] as number | null)}</span></li>`)
      .join('');

    detailEl.innerHTML = `
      <h4>${state}</h4>
      <p>Dishes captured: ${row.dish_count}</p>
      <ul class="metric-list">${metricItems}</ul>
      <h5>Top ingredients</h5>
      <ol class="list ingredient-list">${topIngredients || '<li>No ingredient data</li>'}</ol>
    `;
  }

  function update(metricKey: keyof CuisineStateMetrics) {
    const metric = METRICS.find((m) => m.key === metricKey)!;
    descriptionEl.textContent = metric.description;

    currentValues = new Map<string, number | null>();
    for (const row of data.cuisine) {
      const value = row[metricKey] as number | null;
      currentValues.set(row.state, value ?? null);
    }

    const numericValues = Array.from(currentValues.values()).filter((v): v is number => v != null);
    const extent = d3.extent(numericValues) as [number, number] | undefined;
    const domain: [number, number] = extent ?? [0, 1];
    const scaleDomain: [number, number] = domain[0] === domain[1] ? [0, domain[0] || 1] : domain;
    const palette = d3.interpolateRgbBasis(['#0b2135', '#ff9933', '#f6efe3', '#138808']);
    const sequential = d3.scaleSequential(palette).domain(scaleDomain);
    currentColorScale = (v: number) => sequential(v);

    const legendFormatter = metricKey.startsWith('avg') || metricKey === 'dish_count'
      ? (v: number) => formatNumber(v)
      : (v: number) => `${(v * 100).toFixed(0)}%`;

    choropleth.update({
      data: currentValues,
      colorScale: currentColorScale,
      highlighted: currentState,
      tooltipFormatter
    });

    legend.update({
      title: metric.label,
      domain: scaleDomain,
      scale: currentColorScale,
      format: legendFormatter
    });

    const sorted = data.cuisine
      .map((row) => ({ state: row.state, value: row[metricKey] as number | null }))
      .filter((d): d is { state: string; value: number } => d.value != null)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    topList.innerHTML = sorted
      .map((d) => `<li><span>${d.state}</span><span>${metric.formatter(d.value)}</span></li>`)
      .join('');
  }

  metricSelect.addEventListener('change', () => update(metricSelect.value as keyof CuisineStateMetrics));

  update(metricSelect.value as keyof CuisineStateMetrics);
}
