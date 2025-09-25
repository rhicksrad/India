import * as d3 from 'd3';
import type { AppData } from '../data/load';
import type { CuisineStateMetrics, JoinedStateMetrics } from '../data/types';
import { createChoropleth } from '../viz/choropleth';
import { createLegend } from '../viz/legend';
import { renderScatter, type ScatterPoint } from '../viz/scatter';

interface CuisineMetricOption {
  key: keyof CuisineStateMetrics;
  label: string;
  formatter: (value: number | null) => string;
}

interface CancerMetricOption {
  key: keyof NonNullable<JoinedStateMetrics['cancer']>;
  label: string;
  formatter: (value: number | null) => string;
  legendFormatter: (value: number) => string;
  isRate: boolean;
}

const cuisineMetrics: CuisineMetricOption[] = [
  { key: 'pct_veg', label: 'Vegetarian share', formatter: formatPct },
  { key: 'pct_sweet', label: 'Sweet flavor share', formatter: formatPct },
  { key: 'pct_lentil_like', label: 'Lentil mention share', formatter: formatPct },
  { key: 'pct_red_meat_like', label: 'Red meat mention share', formatter: formatPct },
  { key: 'pct_poultry', label: 'Poultry mention share', formatter: formatPct },
  { key: 'pct_fish', label: 'Fish mention share', formatter: formatPct },
  { key: 'pct_turmeric', label: 'Turmeric mention share', formatter: formatPct },
  { key: 'avg_prep_time', label: 'Average prep time (min)', formatter: formatNumber },
  { key: 'avg_cook_time', label: 'Average cook time (min)', formatter: formatNumber },
  { key: 'dish_count', label: 'Dish count', formatter: formatNumber }
];

const cancerMetrics: CancerMetricOption[] = [
  { key: 'incidence_2019', label: 'Cancer incidence 2019', formatter: formatCount, legendFormatter: formatCount, isRate: false },
  { key: 'incidence_2020', label: 'Cancer incidence 2020', formatter: formatCount, legendFormatter: formatCount, isRate: false },
  { key: 'incidence_2021', label: 'Cancer incidence 2021', formatter: formatCount, legendFormatter: formatCount, isRate: false },
  { key: 'incidence_2022', label: 'Cancer incidence 2022', formatter: formatCount, legendFormatter: formatCount, isRate: false },
  {
    key: 'incidence_cagr_19_22',
    label: 'Cancer incidence CAGR (2019-22)',
    formatter: formatPct,
    legendFormatter: (v) => `${(v * 100).toFixed(1)}%`,
    isRate: true
  }
];

function formatPct(value: number | null) {
  return value == null ? 'No data' : `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null) {
  if (value == null) return 'No data';
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function formatCount(value: number | null) {
  return value == null ? 'No data' : value.toLocaleString('en-IN');
}

export function renderCompareView(root: HTMLElement, data: AppData) {
  root.innerHTML = '';
  root.className = 'view view-compare';

  const layout = document.createElement('div');
  layout.className = 'view-grid';
  const mapContainer = document.createElement('div');
  mapContainer.className = 'map-column';
  const panel = document.createElement('div');
  panel.className = 'panel-column';

  layout.append(mapContainer, panel);
  root.append(layout);

  let residualMap = new Map<string, number | null>();
  let residualInfo = new Map<string, { actual: number; predicted: number; residual: number; cuisine: number }>();
  let colorScale: (value: number) => string = () => '#ccc';
  let currentState: string | null = null;

  const choropleth = createChoropleth({
    container: mapContainer,
    topology: data.topology,
    onHover: (state) => {
      currentState = state;
      renderResidualDetail(state);
    }
  });

  panel.innerHTML = `
    <div class="panel-section">
      <label for="compare-cuisine">Cuisine metric</label>
      <select id="compare-cuisine" class="control"></select>
      <label for="compare-cancer">Cancer metric</label>
      <select id="compare-cancer" class="control"></select>
    </div>
    <div class="panel-section stats">
      <div>Pearson r: <span class="stat-correlation">—</span></div>
      <div>Linear fit: <span class="stat-fit">—</span></div>
      <div>Sample size: <span class="stat-sample">—</span></div>
    </div>
    <div class="panel-section">
      <h3>Legend (map shows residual actual minus predicted)</h3>
      <div class="legend-container"></div>
    </div>
    <div class="panel-section">
      <h3>Scatterplot</h3>
      <div class="scatter-container"></div>
    </div>
    <div class="panel-section">
      <h3>Residuals</h3>
      <div class="residual-detail">Hover a state to see residual details.</div>
      <div class="residual-lists">
        <div>
          <h4>Highest residuals</h4>
          <ol class="list residual-positive"></ol>
        </div>
        <div>
          <h4>Lowest residuals</h4>
          <ol class="list residual-negative"></ol>
        </div>
      </div>
    </div>
  `;

  const cuisineSelect = panel.querySelector<HTMLSelectElement>('#compare-cuisine')!;
  const cancerSelect = panel.querySelector<HTMLSelectElement>('#compare-cancer')!;
  const legend = createLegend({ container: panel.querySelector('.legend-container') as HTMLElement });
  const scatterContainer = panel.querySelector<HTMLDivElement>('.scatter-container')!;
  const residualDetail = panel.querySelector<HTMLDivElement>('.residual-detail')!;
  const positiveList = panel.querySelector<HTMLOListElement>('.residual-positive')!;
  const negativeList = panel.querySelector<HTMLOListElement>('.residual-negative')!;
  const statCorrelation = panel.querySelector<HTMLSpanElement>('.stat-correlation')!;
  const statFit = panel.querySelector<HTMLSpanElement>('.stat-fit')!;
  const statSample = panel.querySelector<HTMLSpanElement>('.stat-sample')!;

  cuisineMetrics.forEach((metric) => {
    const option = document.createElement('option');
    option.value = metric.key as string;
    option.textContent = metric.label;
    cuisineSelect.append(option);
  });
  cuisineSelect.value = 'pct_veg';

  cancerMetrics.forEach((metric) => {
    const option = document.createElement('option');
    option.value = metric.key as string;
    option.textContent = metric.label;
    cancerSelect.append(option);
  });
  cancerSelect.value = 'incidence_2022';

  function renderResidualDetail(state: string | null) {
    if (!state) {
      residualDetail.textContent = 'Hover a state to see residual details.';
      return;
    }
    const info = residualInfo.get(state);
    if (!info) {
      residualDetail.textContent = `No overlapping data for ${state}.`;
      return;
    }
    const cancerMetric = getSelectedCancerMetric();
    const cuisineMetric = getSelectedCuisineMetric();
    residualDetail.innerHTML = `
      <div class="tooltip-title">${state}</div>
      <div>${cuisineMetric.label}: ${cuisineMetric.formatter(info.cuisine)}</div>
      <div>Actual: ${cancerMetric.formatter(info.actual)}</div>
      <div>Predicted: ${cancerMetric.formatter(info.predicted)}</div>
      <div>Residual: ${cancerMetric.formatter(info.residual)}</div>
    `;
  }

  function getSelectedCuisineMetric() {
    const key = cuisineSelect.value as keyof CuisineStateMetrics;
    return cuisineMetrics.find((m) => m.key === key)!;
  }

  function getSelectedCancerMetric() {
    const key = cancerSelect.value as keyof JoinedStateMetrics['cancer'];
    return cancerMetrics.find((m) => m.key === key)!;
  }

  function update() {
    const cuisineMetric = getSelectedCuisineMetric();
    const cancerMetric = getSelectedCancerMetric();

    const points: ScatterPoint[] = [];
    residualMap = new Map();
    residualInfo = new Map();

    for (const entry of data.joined) {
      const cuisineValue = entry.cuisine?.[cuisineMetric.key] as number | null | undefined;
      const cancerValue = entry.cancer?.[cancerMetric.key] as number | null | undefined;
      if (cuisineValue == null || cancerValue == null) {
        continue;
      }
      points.push({ state: entry.state, x: cuisineValue, y: cancerValue });
    }

    statSample.textContent = `${points.length}`;

    if (points.length === 0) {
      scatterContainer.innerHTML = '<p class="empty-state">No overlapping data available.</p>';
      residualDetail.textContent = 'No overlapping data for selected metrics.';
      positiveList.innerHTML = '';
      negativeList.innerHTML = '';
      choropleth.update({
        data: new Map(),
        colorScale: () => '#ccc',
        highlighted: null,
        tooltipFormatter: () => ''
      });
      legend.update({
        title: 'Residuals',
        domain: [-1, 1],
        scale: () => '#ccc',
        format: (v) => v.toFixed(0)
      });
      statCorrelation.textContent = '—';
      statFit.textContent = '—';
      return;
    }

    const scatterMetrics = renderScatter({ container: scatterContainer }, points, {
      xLabel: cuisineMetric.label,
      yLabel: cancerMetric.label
    });

    if (!scatterMetrics) {
      statCorrelation.textContent = '—';
      statFit.textContent = '—';
      return;
    }

    statCorrelation.textContent = scatterMetrics.r.toFixed(3);
    statFit.textContent = `y = ${(scatterMetrics.slope).toFixed(3)}x + ${(scatterMetrics.intercept).toFixed(3)}`;

    const pointLookup = new Map(points.map((p) => [p.state, p]));
    scatterMetrics.residuals.forEach((item) => {
      const base = pointLookup.get(item.state);
      if (!base) return;
      residualMap.set(item.state, item.residual);
      residualInfo.set(item.state, { ...item, cuisine: base.x });
    });

    const maxAbs = d3.max(scatterMetrics.residuals, (d) => Math.abs(d.residual)) ?? 0;
    const domainValue = maxAbs > 0 ? maxAbs : cancerMetric.isRate ? 0.05 : 1000;
    const scaleDomain: [number, number] = [-domainValue, domainValue];
    const diverging = d3.scaleDiverging((t) => d3.interpolateRdBu(1 - t)).domain([-domainValue, 0, domainValue]);
    colorScale = (value: number) => diverging(value);

    choropleth.update({
      data: residualMap,
      colorScale,
      highlighted: currentState,
      tooltipFormatter: (state, value) => {
        const info = residualInfo.get(state);
        if (!info) {
          return `<div class="tooltip-title">${state}</div><div>No data</div>`;
        }
        return `
          <div class="tooltip-title">${state}</div>
          <div>${cuisineMetric.label}: ${cuisineMetric.formatter(info.cuisine)}</div>
          <div>${cancerMetric.label}: ${cancerMetric.formatter(info.actual)}</div>
          <div>Predicted: ${cancerMetric.formatter(info.predicted)}</div>
          <div>Residual: ${cancerMetric.formatter(info.residual)}</div>
        `;
      }
    });

    legend.update({
      title: 'Residual (actual - predicted)',
      domain: scaleDomain,
      scale: (v) => colorScale(v),
      format: cancerMetric.legendFormatter
    });

    const positives = scatterMetrics.residuals
      .filter((r) => r.residual > 0)
      .sort((a, b) => b.residual - a.residual)
      .slice(0, 5);
    const negatives = scatterMetrics.residuals
      .filter((r) => r.residual < 0)
      .sort((a, b) => a.residual - b.residual)
      .slice(0, 5);

    positiveList.innerHTML = positives
      .map((r) => `<li><span>${r.state}</span><span>${cancerMetric.formatter(r.residual)}</span></li>`)
      .join('');
    negativeList.innerHTML = negatives
      .map((r) => `<li><span>${r.state}</span><span>${cancerMetric.formatter(r.residual)}</span></li>`)
      .join('');

    renderResidualDetail(currentState);
  }

  cuisineSelect.addEventListener('change', update);
  cancerSelect.addEventListener('change', update);

  update();
}
