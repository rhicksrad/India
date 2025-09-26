import * as d3 from 'd3';
import type { AppData } from '../data/load';
import type { CuisineStateMetrics, JoinedStateMetrics } from '../data/types';
import { createChoropleth } from '../viz/choropleth';
import { createLegend } from '../viz/legend';
import { computeScatter, renderScatter, type ScatterPoint } from '../viz/scatter';

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
  fallbackRange: number;
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
  {
    key: 'incidence_per_100k_2019',
    label: 'Cancer incidence per 100k (2019)',
    formatter: formatPer100k,
    legendFormatter: (v) => v.toFixed(1),
    isRate: true,
    fallbackRange: 10
  },
  {
    key: 'incidence_per_100k_2020',
    label: 'Cancer incidence per 100k (2020)',
    formatter: formatPer100k,
    legendFormatter: (v) => v.toFixed(1),
    isRate: true,
    fallbackRange: 10
  },
  {
    key: 'incidence_per_100k_2021',
    label: 'Cancer incidence per 100k (2021)',
    formatter: formatPer100k,
    legendFormatter: (v) => v.toFixed(1),
    isRate: true,
    fallbackRange: 10
  },
  {
    key: 'incidence_per_100k_2022',
    label: 'Cancer incidence per 100k (2022)',
    formatter: formatPer100k,
    legendFormatter: (v) => v.toFixed(1),
    isRate: true,
    fallbackRange: 10
  },
  {
    key: 'incidence_2019',
    label: 'Cancer incidence total (2019)',
    formatter: formatCount,
    legendFormatter: formatCount,
    isRate: false,
    fallbackRange: 1_000
  },
  {
    key: 'incidence_2020',
    label: 'Cancer incidence total (2020)',
    formatter: formatCount,
    legendFormatter: formatCount,
    isRate: false,
    fallbackRange: 1_000
  },
  {
    key: 'incidence_2021',
    label: 'Cancer incidence total (2021)',
    formatter: formatCount,
    legendFormatter: formatCount,
    isRate: false,
    fallbackRange: 1_000
  },
  {
    key: 'incidence_2022',
    label: 'Cancer incidence total (2022)',
    formatter: formatCount,
    legendFormatter: formatCount,
    isRate: false,
    fallbackRange: 1_000
  },
  {
    key: 'incidence_cagr_19_22',
    label: 'Cancer incidence CAGR (2019-22)',
    formatter: formatPct,
    legendFormatter: (v) => `${(v * 100).toFixed(1)}%`,
    isRate: true,
    fallbackRange: 0.05
  }
];

const INGREDIENT_SELECT_VALUE = '__ingredient__';

interface IngredientInfo {
  name: string;
  displayName: string;
  states: Map<string, number>;
  averageShare: number;
  stateCount: number;
}

type CuisineSelection =
  | { kind: 'preset'; option: CuisineMetricOption }
  | { kind: 'ingredient'; ingredient: IngredientInfo };

interface ActiveCuisineMetric {
  selection: CuisineSelection;
  label: string;
  formatter: (value: number | null) => string;
}

interface ComboSuggestion {
  cuisine: CuisineSelection;
  cancer: CancerMetricOption;
  r: number;
  sample: number;
}

const MEASUREMENT_WORDS = new Set([
  'tablespoon',
  'tablespoons',
  'teaspoon',
  'teaspoons',
  'cup',
  'cups',
  'tbsp',
  'tsp',
  'gram',
  'grams',
  'g',
  'kg',
  'ml',
  'l',
  'litre',
  'liter',
  'handful',
  'pinch',
  'sprig',
  'sprigs',
  'dash',
  'slice',
  'slices',
  'piece',
  'pieces'
]);

const FILTER_WORDS = new Set([
  'to',
  'taste',
  'as',
  'needed',
  'optional',
  'finely',
  'finely-chopped',
  'thinly',
  'roughly',
  'chopped',
  'diced',
  'sliced',
  'grated',
  'ground',
  'roasted',
  'powder',
  'paste',
  'fresh',
  'dry',
  'dried',
  'whole',
  'large',
  'small',
  'medium',
  'big',
  'little'
]);

function normalizeIngredientToken(token: string): string {
  if (!token) return '';
  const words = token
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const filtered: string[] = [];
  for (const word of words) {
    if (MEASUREMENT_WORDS.has(word) || FILTER_WORDS.has(word)) continue;
    if (/^[0-9]+/.test(word)) continue;
    filtered.push(word);
  }

  if (filtered.length === 0) {
    return token.toLowerCase().trim();
  }

  return filtered.join(' ').trim();
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildIngredientUniverse(rows: CuisineStateMetrics[]) {
  const stateShares = new Map<string, Map<string, number>>();
  const ingredientData = new Map<string, { states: Map<string, number>; totalShare: number }>();

  for (const row of rows) {
    const dishCount = row.dish_count;
    const normalizedCounts = new Map<string, number>();
    for (const [rawToken, count] of Object.entries(row.ingredient_stats ?? {})) {
      const normalized = normalizeIngredientToken(rawToken);
      if (!normalized) continue;
      const capped = Math.min(count, row.dish_count);
      const prev = normalizedCounts.get(normalized) ?? 0;
      normalizedCounts.set(normalized, Math.min(row.dish_count, prev + capped));
    }
    const shareMap = new Map<string, number>();
    if (dishCount > 0) {
      normalizedCounts.forEach((count, normalized) => {
        const share = Math.min(count, dishCount) / dishCount;
        if (share > 0) {
          shareMap.set(normalized, share);
        }
      });
    }
    stateShares.set(row.state, shareMap);
    shareMap.forEach((share, ingredient) => {
      let info = ingredientData.get(ingredient);
      if (!info) {
        info = { states: new Map<string, number>(), totalShare: 0 };
        ingredientData.set(ingredient, info);
      }
      info.states.set(row.state, share);
      info.totalShare += share;
    });
  }

  const ingredientInfos: IngredientInfo[] = Array.from(ingredientData.entries())
    .map(([name, info]) => ({
      name,
      displayName: titleCase(name),
      states: info.states,
      averageShare: info.states.size ? info.totalShare / info.states.size : 0,
      stateCount: info.states.size
    }))
    .sort((a, b) => {
      if (b.averageShare !== a.averageShare) return b.averageShare - a.averageShare;
      if (b.stateCount !== a.stateCount) return b.stateCount - a.stateCount;
      return a.name.localeCompare(b.name);
    });

  const ingredientIndex = new Map<string, IngredientInfo>(ingredientInfos.map((info) => [info.name, info]));

  return { ingredientInfos, ingredientIndex, stateShares };
}

function resolveIngredient(
  value: string,
  index: Map<string, IngredientInfo>,
  list: IngredientInfo[]
): IngredientInfo | null {
  const normalized = normalizeIngredientToken(value.trim());
  if (!normalized) return null;
  const direct = index.get(normalized);
  if (direct) return direct;
  const fallback = list.find((info) => info.name.includes(normalized));
  if (fallback) return fallback;
  const fuzzy = list.find((info) => normalized.includes(info.name));
  return fuzzy ?? null;
}

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

function formatPer100k(value: number | null) {
  return value == null ? 'No data' : `${value.toFixed(1)} per 100k`;
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
  let colorScale: (value: number) => string = () => '#163346';
  let currentState: string | null = null;
  let lastCuisineMetric: ActiveCuisineMetric | null = null;
  let lastCancerMetric: CancerMetricOption | null = null;

  const choropleth = createChoropleth({
    container: mapContainer,
    topology: data.topology,
    onHover: (state) => {
      currentState = state;
      renderResidualDetail(state);
    }
  });

  const { ingredientInfos, ingredientIndex, stateShares: stateIngredientShares } = buildIngredientUniverse(data.cuisine);

  panel.innerHTML = `
    <div class="panel-section">
      <label for="compare-cuisine">Cuisine metric</label>
      <select id="compare-cuisine" class="control"></select>
      <div class="ingredient-picker hidden">
        <label for="ingredient-query">Ingredient keyword</label>
        <input id="ingredient-query" class="control" placeholder="Try onion, garlic, rice…" list="ingredient-options" autocomplete="off" />
        <datalist id="ingredient-options"></datalist>
        <p class="ingredient-summary">Type a keyword to explore ingredient usage across states.</p>
      </div>
      <label for="compare-cancer">Cancer metric</label>
      <select id="compare-cancer" class="control"></select>
    </div>
    <div class="panel-section stats">
      <div>Pearson r: <span class="stat-correlation">—</span></div>
      <div>Linear fit: <span class="stat-fit">—</span></div>
      <div>Sample size: <span class="stat-sample">—</span></div>
    </div>
    <div class="panel-section combos">
      <h3>Interesting correlations</h3>
      <p class="combo-help">Click a pairing to load it in the chart.</p>
      <div class="combo-grid"></div>
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
  const ingredientPicker = panel.querySelector<HTMLDivElement>('.ingredient-picker')!;
  const ingredientInput = panel.querySelector<HTMLInputElement>('#ingredient-query')!;
  const ingredientSummary = panel.querySelector<HTMLParagraphElement>('.ingredient-summary')!;
  const ingredientOptions = panel.querySelector<HTMLDataListElement>('#ingredient-options')!;
  const comboGrid = panel.querySelector<HTMLDivElement>('.combo-grid')!;
  const comboHelp = panel.querySelector<HTMLParagraphElement>('.combo-help')!;
  const legend = createLegend({ container: panel.querySelector('.legend-container') as HTMLElement });
  const scatterContainer = panel.querySelector<HTMLDivElement>('.scatter-container')!;
  const residualDetail = panel.querySelector<HTMLDivElement>('.residual-detail')!;
  const positiveList = panel.querySelector<HTMLOListElement>('.residual-positive')!;
  const negativeList = panel.querySelector<HTMLOListElement>('.residual-negative')!;
  const statCorrelation = panel.querySelector<HTMLSpanElement>('.stat-correlation')!;
  const statFit = panel.querySelector<HTMLSpanElement>('.stat-fit')!;
  const statSample = panel.querySelector<HTMLSpanElement>('.stat-sample')!;

  const suggestedIngredients = ingredientInfos.filter((info) => info.stateCount >= 4).slice(0, 250);
  suggestedIngredients.forEach((info) => {
    const option = document.createElement('option');
    option.value = info.name;
    option.label = `${info.displayName} (${(info.averageShare * 100).toFixed(0)}% avg)`;
    ingredientOptions.append(option);
  });

  const ingredientOption = document.createElement('option');
  ingredientOption.value = INGREDIENT_SELECT_VALUE;
  ingredientOption.textContent = 'Ingredient usage share…';
  cuisineSelect.append(ingredientOption);

  cuisineMetrics.forEach((metric) => {
    const option = document.createElement('option');
    option.value = metric.key as string;
    option.textContent = metric.label;
    cuisineSelect.append(option);
  });

  const defaultIngredient = resolveIngredient('onion', ingredientIndex, ingredientInfos) ?? ingredientInfos[0] ?? null;
  if (defaultIngredient) {
    ingredientInput.value = defaultIngredient.name;
  }

  cuisineSelect.value = ingredientOption.value;

  cancerMetrics.forEach((metric) => {
    const option = document.createElement('option');
    option.value = metric.key as string;
    option.textContent = metric.label;
    cancerSelect.append(option);
  });
  cancerSelect.value = 'incidence_per_100k_2022';

  const interestingCombos = computeInterestingCombos();
  renderComboSuggestions();

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
    if (!lastCuisineMetric || !lastCancerMetric) {
      residualDetail.textContent = 'Select a cuisine metric to inspect residuals.';
      return;
    }
    residualDetail.innerHTML = `
      <div class="tooltip-title">${state}</div>
      <div>${lastCuisineMetric.label}: ${lastCuisineMetric.formatter(info.cuisine)}</div>
      <div>Actual: ${lastCancerMetric.formatter(info.actual)}</div>
      <div>Predicted: ${lastCancerMetric.formatter(info.predicted)}</div>
      <div>Residual: ${lastCancerMetric.formatter(info.residual)}</div>
    `;
  }

  function describeCuisineSelection(selection: CuisineSelection) {
    if (selection.kind === 'preset') {
      return selection.option.label;
    }
    return `Share mentioning ${selection.ingredient.displayName}`;
  }

  function getCuisineValue(row: CuisineStateMetrics | null, selection: CuisineSelection): number | null {
    if (!row) return null;
    if (selection.kind === 'preset') {
      const value = row[selection.option.key] as number | null | undefined;
      return value ?? null;
    }
    if (row.dish_count === 0) return null;
    const shareMap = stateIngredientShares.get(row.state);
    if (!shareMap) return 0;
    return shareMap.get(selection.ingredient.name) ?? 0;
  }

  function getSelectedCancerMetric() {
    const key = cancerSelect.value as keyof JoinedStateMetrics['cancer'];
    return cancerMetrics.find((m) => m.key === key)!;
  }

  function updateIngredientSummary(info: IngredientInfo | null) {
    if (!info) {
      ingredientSummary.innerHTML = 'Type a keyword to explore ingredient usage across states.';
      return;
    }
    const topStates = Array.from(info.states.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([state, share]) => `${state} (${formatPct(share)})`)
      .join(', ');
    const average = formatPct(info.averageShare);
    ingredientSummary.innerHTML = `Appears in ${info.stateCount} states • Average share ${average}${topStates ? `<br/>Top mentions: ${topStates}` : ''}`;
  }

  function getSelectedCuisineMetric(): ActiveCuisineMetric | null {
    if (cuisineSelect.value === INGREDIENT_SELECT_VALUE) {
      ingredientPicker.classList.remove('hidden');
      const info = resolveIngredient(ingredientInput.value, ingredientIndex, ingredientInfos);
      updateIngredientSummary(info);
      if (!info) {
        return null;
      }
      ingredientInput.value = info.name;
      return {
        selection: { kind: 'ingredient', ingredient: info },
        label: `Share of dishes mentioning ${info.displayName}`,
        formatter: formatPct
      };
    }
    ingredientPicker.classList.add('hidden');
    const key = cuisineSelect.value as keyof CuisineStateMetrics;
    const metric = cuisineMetrics.find((m) => m.key === key);
    if (!metric) return null;
    return {
      selection: { kind: 'preset', option: metric },
      label: metric.label,
      formatter: metric.formatter
    };
  }

  function isSameSelection(a: CuisineSelection, b: CuisineSelection) {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'preset' && b.kind === 'preset') {
      return a.option.key === b.option.key;
    }
    if (a.kind === 'ingredient' && b.kind === 'ingredient') {
      return a.ingredient.name === b.ingredient.name;
    }
    return false;
  }

  function updateComboHighlights(cuisineMetric: ActiveCuisineMetric | null, cancerMetric: CancerMetricOption | null) {
    const cards = comboGrid.querySelectorAll<HTMLButtonElement>('.combo-card');
    cards.forEach((card) => {
      const index = Number(card.dataset.index ?? '-1');
      const combo = interestingCombos[index];
      if (!combo || !cuisineMetric || !cancerMetric) {
        card.classList.remove('active');
        return;
      }
      const isMatch = combo.cancer.key === cancerMetric.key && isSameSelection(combo.cuisine, cuisineMetric.selection);
      card.classList.toggle('active', isMatch);
    });
  }

  function renderComboSuggestions() {
    comboGrid.innerHTML = '';
    if (!interestingCombos.length) {
      comboHelp.textContent = 'Not enough overlapping data to surface correlations yet.';
      return;
    }
    interestingCombos.forEach((combo, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'combo-card';
      button.dataset.index = String(index);
      button.classList.add(combo.r >= 0 ? 'positive' : 'negative');
      button.innerHTML = `
        <div class="combo-title">${describeCuisineSelection(combo.cuisine)} vs ${combo.cancer.label}</div>
        <div class="combo-meta">r = ${combo.r.toFixed(2)} • n = ${combo.sample}</div>
      `;
      comboGrid.append(button);
    });
  }

  function computeInterestingCombos(): ComboSuggestion[] {
    const combos: ComboSuggestion[] = [];
    const ingredientCandidates = ingredientInfos.filter((info) => info.stateCount >= 6).slice(0, 60);
    const cuisineCandidates: CuisineSelection[] = [
      ...cuisineMetrics.map((metric) => ({ kind: 'preset', option: metric } as CuisineSelection)),
      ...ingredientCandidates.map((ingredient) => ({ kind: 'ingredient', ingredient } as CuisineSelection))
    ];

    for (const cuisineCandidate of cuisineCandidates) {
      for (const cancerMetric of cancerMetrics) {
        const points: ScatterPoint[] = [];
        for (const entry of data.joined) {
          const cuisineValue = getCuisineValue(entry.cuisine, cuisineCandidate);
          const cancerValue = entry.cancer?.[cancerMetric.key] as number | null | undefined;
          if (cuisineValue == null || cancerValue == null) continue;
          points.push({ state: entry.state, x: cuisineValue, y: cancerValue });
        }
        if (points.length < 6) continue;
        const computation = computeScatter(points);
        if (!computation) continue;
        combos.push({ cuisine: cuisineCandidate, cancer: cancerMetric, r: computation.metrics.r, sample: points.length });
      }
    }

    combos.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    return combos.slice(0, 18);
  }

  function applyComboSelection(combo: ComboSuggestion) {
    if (combo.cuisine.kind === 'preset') {
      cuisineSelect.value = combo.cuisine.option.key as string;
    } else {
      cuisineSelect.value = INGREDIENT_SELECT_VALUE;
      ingredientInput.value = combo.cuisine.ingredient.name;
    }
    cancerSelect.value = combo.cancer.key as string;
    update();
  }

  comboGrid.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.combo-card');
    if (!target) return;
    const combo = interestingCombos[Number(target.dataset.index ?? '-1')];
    if (!combo) return;
    applyComboSelection(combo);
  });

  function update() {
    const cuisineMetric = getSelectedCuisineMetric();
    const cancerMetric = getSelectedCancerMetric();

    lastCuisineMetric = cuisineMetric;
    lastCancerMetric = cancerMetric;

    residualMap = new Map();
    residualInfo = new Map();

    if (!cuisineMetric) {
      statSample.textContent = '0';
      scatterContainer.innerHTML = '<p class="empty-state">Select a cuisine metric or choose an ingredient with data.</p>';
      residualDetail.textContent = 'Type an ingredient keyword to explore residuals.';
      positiveList.innerHTML = '';
      negativeList.innerHTML = '';
      choropleth.update({
        data: new Map(),
        colorScale: () => '#163346',
        highlighted: currentState,
        tooltipFormatter: (state) => `<div class="tooltip-title">${state}</div><div>No data</div>`
      });
      legend.update({
        title: 'Residuals',
        domain: [-1, 1],
        scale: () => '#163346',
        format: (v) => v.toFixed(0)
      });
      statCorrelation.textContent = '—';
      statFit.textContent = '—';
      updateComboHighlights(null, cancerMetric);
      return;
    }

    const points: ScatterPoint[] = [];
    for (const entry of data.joined) {
      const cuisineValue = getCuisineValue(entry.cuisine, cuisineMetric.selection);
      const cancerValue = entry.cancer?.[cancerMetric.key] as number | null | undefined;
      if (cuisineValue == null || cancerValue == null) continue;
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
        colorScale: () => '#163346',
        highlighted: currentState,
        tooltipFormatter: () => ''
      });
      legend.update({
        title: 'Residuals',
        domain: [-1, 1],
        scale: () => '#163346',
        format: (v) => v.toFixed(0)
      });
      statCorrelation.textContent = '—';
      statFit.textContent = '—';
      updateComboHighlights(cuisineMetric, cancerMetric);
      return;
    }

    const scatterMetrics = renderScatter({ container: scatterContainer }, points, {
      xLabel: cuisineMetric.label,
      yLabel: cancerMetric.label
    });

    if (!scatterMetrics) {
      statCorrelation.textContent = '—';
      statFit.textContent = '—';
      updateComboHighlights(cuisineMetric, cancerMetric);
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
    const domainValue = maxAbs > 0 ? maxAbs : cancerMetric.fallbackRange;
    const scaleDomain: [number, number] = [-domainValue, domainValue];
    const divergingPalette = d3.interpolateRgbBasis(['#ff9933', '#0b2135', '#138808']);
    const diverging = d3.scaleDiverging((t) => divergingPalette(t)).domain([-domainValue, 0, domainValue]);
    colorScale = (value: number) => diverging(value);

    choropleth.update({
      data: residualMap,
      colorScale,
      highlighted: currentState,
      tooltipFormatter: (state) => {
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
    updateComboHighlights(cuisineMetric, cancerMetric);
  }

  cuisineSelect.addEventListener('change', update);
  cancerSelect.addEventListener('change', update);
  ingredientInput.addEventListener('change', update);
  ingredientInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      update();
    }
  });
  ingredientInput.addEventListener('input', () => {
    if (cuisineSelect.value !== INGREDIENT_SELECT_VALUE) return;
    const info = resolveIngredient(ingredientInput.value, ingredientIndex, ingredientInfos);
    updateIngredientSummary(info);
  });

  update();
}
