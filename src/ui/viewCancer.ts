import * as d3 from 'd3';
import type { AppData } from '../data/load';
import { createChoropleth } from '../viz/choropleth';
import { createLegend } from '../viz/legend';

const YEARS = ['2019', '2020', '2021', '2022'] as const;
type YearKey = (typeof YEARS)[number];

const YEAR_VALUE_KEYS: Record<YearKey, keyof AppData['cancer'][number]> = {
  '2019': 'incidence_per_100k_2019',
  '2020': 'incidence_per_100k_2020',
  '2021': 'incidence_per_100k_2021',
  '2022': 'incidence_per_100k_2022',
};

export function renderCancerView(root: HTMLElement, data: AppData) {
  root.innerHTML = '';
  root.className = 'view view-cancer';

  const layout = document.createElement('div');
  layout.className = 'cancer-layout';
  root.append(layout);

  const mapCard = document.createElement('section');
  mapCard.className = 'card cancer-map-card';
  layout.append(mapCard);

  const mapContainer = document.createElement('div');
  mapContainer.className = 'cancer-map-container';
  mapCard.append(mapContainer);

  const controls = document.createElement('div');
  controls.className = 'cancer-controls';
  controls.innerHTML = `
    <div class="control-group">
      <label for="cancer-year">Year</label>
      <select id="cancer-year" class="control"></select>
    </div>
    <div class="legend-panel">
      <h3>Legend</h3>
      <div class="legend-container"></div>
    </div>
  `;
  mapCard.append(controls);

  const statsCard = document.createElement('section');
  statsCard.className = 'card cancer-stats-card';
  statsCard.innerHTML = `
    <div class="panel-section">
      <h3>Top 5 incidence per 100k</h3>
      <ol class="list top-list"></ol>
    </div>
    <div class="panel-section">
      <h3>Bottom 5 incidence per 100k</h3>
      <ol class="list bottom-list"></ol>
    </div>
  `;
  layout.append(statsCard);

  const choropleth = createChoropleth({
    container: mapContainer,
    topology: data.topology,
  });

  const yearSelect = controls.querySelector<HTMLSelectElement>('#cancer-year')!;
  YEARS.forEach((year) => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.append(option);
  });
  yearSelect.value = '2022';

  const legend = createLegend({ container: controls.querySelector('.legend-container') as HTMLElement });

  const topList = statsCard.querySelector<HTMLOListElement>('.top-list')!;
  const bottomList = statsCard.querySelector<HTMLOListElement>('.bottom-list')!;

  const byState = new Map(data.cancer.map((row) => [row.state, row]));

  function computeMapValues(year: YearKey) {
    const map = new Map<string, number | null>();
    for (const row of data.cancer) {
      const key = YEAR_VALUE_KEYS[year];
      const value = row[key] as number | null;
      map.set(row.state, value ?? null);
    }
    return map;
  }

  function formatPer100k(value: number | null) {
    if (value == null) return 'No data';
    return `${value.toFixed(1)} per 100k`;
  }

  function formatCount(value: number | null) {
    if (value == null) return 'No data';
    return value.toLocaleString('en-US');
  }

  function updateLists(year: YearKey) {
    const perCapitaKey = YEAR_VALUE_KEYS[year];
    const totalKey = `incidence_${year}` as const;
    const entries = data.cancer
      .map((row) => ({
        state: row.state,
        perCapita: row[perCapitaKey] as number | null,
        total: row[totalKey] as number | null,
      }))
      .filter((d): d is { state: string; perCapita: number; total: number | null } => d.perCapita != null)
      .sort((a, b) => b.perCapita - a.perCapita);

    const top = entries.slice(0, 5);
    const bottom = entries.slice(-5).reverse();

    topList.innerHTML = top
      .map(
        (d) =>
          `<li><span>${d.state}</span><span>${d.perCapita.toFixed(1)} per 100k (${formatCount(d.total)})</span></li>`,
      )
      .join('');
    bottomList.innerHTML = bottom
      .map(
        (d) =>
          `<li><span>${d.state}</span><span>${d.perCapita.toFixed(1)} per 100k (${formatCount(d.total)})</span></li>`,
      )
      .join('');
  }

  function update(year: YearKey) {
    const values = computeMapValues(year);
    const numericValues = Array.from(values.values()).filter((v): v is number => v != null);
    const ext = d3.extent(numericValues);
    const min = ext[0] ?? 0;
    const max = ext[1] ?? (min || 1);
    const domain: [number, number] = min === max ? [0, max] : [min, max];

    const palette = d3.interpolateRgbBasis(['#0b2135', '#ff9933', '#f6efe3', '#138808']);
    const scale = d3.scaleSequential(palette).domain(domain);

    choropleth.update({
      data: values,
      colorScale: (v) => scale(v),
      highlighted: null,
      tooltipFormatter: (state, value) => {
        const cancerRow = byState.get(state);
        const growth = cancerRow?.incidence_cagr_19_22;
        const totalKey = `incidence_${year}` as const;
        const totalValue = cancerRow?.[totalKey] as number | null | undefined;
        const growthText = growth == null ? '—' : `${(growth * 100).toFixed(2)}% CAGR (2019-22)`;
        return `
          <div class="tooltip-title">${state}</div>
          <div>${year}: ${formatPer100k(value)}</div>
          <div>${year} total: ${formatCount(totalValue ?? null)}</div>
          <div>CAGR: ${growthText}</div>
        `;
      },
    });

    legend.update({
      title: `Incidence ${year}`,
      domain,
      scale: (v) => scale(v),
      format: (v) => v.toFixed(1),
    });

    updateLists(year);
  }

  yearSelect.addEventListener('change', () => update(yearSelect.value as YearKey));

  update(yearSelect.value as YearKey);
}

