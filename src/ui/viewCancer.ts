import * as d3 from 'd3';
import type { AppData } from '../data/load';
import { createChoropleth } from '../viz/choropleth';
import { createLegend } from '../viz/legend';

const YEARS = ['2019', '2020', '2021', '2022'] as const;
type YearKey = (typeof YEARS)[number];

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
    <div class="stats-section">
      <h3>Top 5 incidence</h3>
      <ol class="list top-list"></ol>
    </div>
    <div class="stats-section">
      <h3>Bottom 5 incidence</h3>
      <ol class="list bottom-list"></ol>
    </div>
  `;
  layout.append(statsCard);

  const choropleth = createChoropleth({
    container: mapContainer,
    topology: data.topology
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
      const key = `incidence_${year}` as const;
      const value = row[key] as number | null;
      map.set(row.state, value ?? null);
    }
    return map;
  }

  function formatValue(value: number | null) {
    if (value == null) return 'No data';
    return value.toLocaleString('en-IN');
  }

  function updateLists(year: YearKey) {
    const key = `incidence_${year}` as const;
    const entries = data.cancer
      .map((row) => ({ state: row.state, value: row[key] as number | null }))
      .filter((d): d is { state: string; value: number } => d.value != null)
      .sort((a, b) => b.value - a.value);

    const top = entries.slice(0, 5);
    const bottom = entries.slice(-5).reverse();

    topList.innerHTML = top
      .map((d) => `<li><span>${d.state}</span><span>${d.value.toLocaleString('en-IN')}</span></li>`)
      .join('');
    bottomList.innerHTML = bottom
      .map((d) => `<li><span>${d.state}</span><span>${d.value.toLocaleString('en-IN')}</span></li>`)
      .join('');
  }

  function update(year: YearKey) {
    const values = computeMapValues(year);
    const numericValues = Array.from(values.values()).filter((v): v is number => v != null);
    const extent = d3.extent(numericValues) as [number, number] | undefined;
    const domain: [number, number] = extent ?? [0, 1];
    const palette = d3.interpolateRgbBasis(['#0b2135', '#ff9933', '#f6efe3', '#138808']);
    const scaleDomain: [number, number] = domain[0] === domain[1] ? [0, domain[0] || 1] : domain;
    const scale = d3.scaleSequential(palette).domain(scaleDomain);

    choropleth.update({
      data: values,
      colorScale: (v) => scale(v),
      highlighted: null,
      tooltipFormatter: (state, value) => {
        const cancerRow = byState.get(state);
        const growth = cancerRow?.incidence_cagr_19_22;
        const growthText = growth == null ? '—' : `${(growth * 100).toFixed(2)}% CAGR (2019-22)`;
        return `
          <div class="tooltip-title">${state}</div>
          <div>${year}: ${formatValue(value)}</div>
          <div>CAGR: ${growthText}</div>
        `;
      }
    });

    legend.update({
      title: `Incidence ${year}`,
      domain: scaleDomain,
      scale: (v) => scale(v),
      format: (v) => Math.round(v).toLocaleString('en-IN')
    });

    updateLists(year);
  }

  yearSelect.addEventListener('change', () => update(yearSelect.value as YearKey));

  update(yearSelect.value as YearKey);
}
