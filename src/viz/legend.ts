import * as d3 from 'd3';

export interface LegendConfig {
  container: HTMLElement;
  width?: number;
}

export interface LegendUpdateOptions {
  title: string;
  domain: [number, number];
  scale: (value: number) => string;
  format?: (value: number) => string;
}

export function createLegend(config: LegendConfig) {
  const { container } = config;
  const width = config.width ?? 260;
  const height = 70;
  container.innerHTML = '';

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('class', 'legend-svg');

  const defs = svg.append('defs');
  const gradientId = `legend-gradient-${Math.random().toString(36).slice(2, 8)}`;
  defs.append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%')
    .attr('x2', '100%')
    .attr('y1', '0%')
    .attr('y2', '0%');

  const title = svg
    .append('text')
    .attr('class', 'legend-title')
    .attr('x', width / 2)
    .attr('y', 18)
    .attr('text-anchor', 'middle')
    .text('');

  const barGroup = svg.append('g').attr('transform', `translate(20, ${height / 2})`);
  barGroup
    .append('rect')
    .attr('class', 'legend-bar')
    .attr('x', 0)
    .attr('y', -10)
    .attr('width', width - 40)
    .attr('height', 20)
    .attr('fill', `url(#${gradientId})`)
    .attr('stroke', '#999');

  const axisGroup = barGroup
    .append('g')
    .attr('class', 'legend-axis')
    .attr('transform', 'translate(0, 12)');

  function update(options: LegendUpdateOptions) {
    const { title: legendTitle, domain, scale, format } = options;
    title.text(legendTitle);

    const gradient = defs.select(`#${gradientId}`);
    const stops = d3.range(0, 1.0001, 0.1);
    gradient
      .selectAll('stop')
      .data(stops)
      .join('stop')
      .attr('offset', (d: number) => `${d * 100}%`)
      .attr('stop-color', (d: number) => {
        const value = domain[0] + (domain[1] - domain[0]) * d;
        return scale(value);
      });

    const axisScale = d3.scaleLinear().domain(domain).range([0, width - 40]);
    const tickFormat = format ?? d3.format('.2f');
    const axis = d3.axisBottom(axisScale).ticks(5).tickFormat((d: number | { valueOf(): number }) => tickFormat(Number(d)));
    axisGroup.call(axis as any);
  }

  return { update };
}
