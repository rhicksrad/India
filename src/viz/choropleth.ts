import * as d3 from 'd3';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { IndiaTopology } from '../data/types';

export interface ChoroplethConfig {
  container: HTMLElement;
  topology: IndiaTopology;
  onHover?: (state: string | null) => void;
}

export interface ChoroplethUpdateOptions {
  data: Map<string, number | null>;
  colorScale: (value: number) => string;
  highlighted?: string | null;
  tooltipFormatter: (state: string, value: number | null) => string;
}

function normalizeStateName(rawName: string | undefined) {
  if (!rawName) return '';
  const normalized = rawName.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  // Normalize legacy spellings to match the data files.
  switch (normalized) {
    case 'Orissa':
      return 'Odisha';
    case 'Uttaranchal':
      return 'Uttarakhand';
    default:
      return normalized;
  }
}

export function createChoropleth(config: ChoroplethConfig) {
  const { container, topology, onHover } = config;
  container.innerHTML = '';
  container.classList.add('choropleth-container');

  type StateProperties = { __stateName: string; [key: string]: unknown };
  type StateFeature = Feature<Geometry, StateProperties>;

  const topologyObjects = topology.objects as Record<string, unknown>;
  const firstObjectKey = Object.keys(topologyObjects)[0];
  const firstObject = firstObjectKey ? (topologyObjects[firstObjectKey] as any) : null;
  if (!firstObject) {
    throw new Error('Invalid India topology: expected at least one object.');
  }

  const rawGeojson = feature(topology as unknown as any, firstObject) as unknown as FeatureCollection<Geometry, Record<string, unknown>>;

  const geojson: FeatureCollection<Geometry, StateProperties> = {
    ...rawGeojson,
    features: rawGeojson.features.map((feat) => {
      const rawName = (feat.properties?.name as string | undefined) ?? (feat.properties?.shapeName as string | undefined);
      const stateName = normalizeStateName(rawName);
      return {
        ...feat,
        properties: {
          ...(feat.properties ?? {}),
          __stateName: stateName || rawName || ''
        }
      } as StateFeature;
    })
  };

  const width = 540;
  const height = 600;
  const projection = d3.geoMercator().fitSize([width, height], geojson);
  const path = d3.geoPath(projection);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('class', 'choropleth-svg');

  const states = svg
    .append('g')
    .selectAll<SVGPathElement, StateFeature>('path')
    .data(geojson.features)
    .enter()
    .append('path')
    .attr('d', path as any)
    .attr('class', 'choropleth-state')
    .attr('fill', '#f5f5f5')
    .attr('stroke', '#999')
    .attr('stroke-width', 0.8)
    .attr('vector-effect', 'non-scaling-stroke');

  const tooltip = d3
    .select(container)
    .append('div')
    .attr('class', 'choropleth-tooltip')
    .style('opacity', 0);

  let currentData = new Map<string, number | null>();
  let currentFormatter: ChoroplethUpdateOptions['tooltipFormatter'] = () => '';
  let currentHighlighted: string | null = null;
  let currentColorScale: (value: number) => string = () => '#ccc';

  function showTooltip(state: string, value: number | null, event: MouseEvent) {
    tooltip
      .style('opacity', 1)
      .html(currentFormatter(state, value))
      .style('left', `${event.offsetX + 12}px`)
      .style('top', `${event.offsetY + 12}px`);
  }

  function hideTooltip() {
    tooltip.style('opacity', 0);
  }

  states
    .on('mouseenter', function (event: MouseEvent, d: StateFeature) {
      const state = d.properties?.__stateName ?? '';
      const value = currentData.get(state) ?? null;
      currentHighlighted = state;
      if (onHover) onHover(state);
      showTooltip(state, value, event);
      d3.select(this as SVGPathElement).classed('is-hovered', true);
    })
    .on('mousemove', function (event: MouseEvent, d: StateFeature) {
      const state = d.properties?.__stateName ?? '';
      const value = currentData.get(state) ?? null;
      showTooltip(state, value, event);
    })
    .on('mouseleave', function () {
      currentHighlighted = null;
      if (onHover) onHover(null);
      hideTooltip();
      d3.select(this as SVGPathElement).classed('is-hovered', false);
      updateHighlight();
    });

  function updateHighlight() {
    states.classed('is-selected', (d: StateFeature) => {
      const name = d.properties?.__stateName ?? '';
      return currentHighlighted != null && currentHighlighted === name;
    });
  }

  function applyFill() {
    states.attr('fill', (d: StateFeature) => {
      const name = d.properties?.__stateName ?? '';
      const value = currentData.get(name);
      return value == null ? '#e6e6e6' : currentColorScale(value);
    });
  }

  function update(options: ChoroplethUpdateOptions) {
    currentData = options.data;
    currentFormatter = options.tooltipFormatter;
    currentColorScale = options.colorScale;
    currentHighlighted = options.highlighted ?? null;
    applyFill();
    updateHighlight();
  }

  return { update };
}
