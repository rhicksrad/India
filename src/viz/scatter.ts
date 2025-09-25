import * as d3 from 'd3';

export interface ScatterPoint {
  state: string;
  x: number;
  y: number;
}

export interface ScatterLabels {
  xLabel: string;
  yLabel: string;
}

export interface ScatterMetrics {
  slope: number;
  intercept: number;
  r: number;
  residuals: Array<{ state: string; actual: number; predicted: number; residual: number }>;
}

export interface ScatterConfig {
  container: HTMLElement;
  width?: number;
  height?: number;
}

export function renderScatter(config: ScatterConfig, data: ScatterPoint[], labels: ScatterLabels): ScatterMetrics | null {
  const { container } = config;
  const width = config.width ?? 420;
  const height = config.height ?? 320;
  const margin = { top: 16, right: 24, bottom: 48, left: 56 };

  container.innerHTML = '';

  const valid = data.filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
  if (valid.length === 0) {
    container.innerHTML = '<p class="empty-state">No overlapping data for selected metrics.</p>';
    return null;
  }

  const xExtent = d3.extent(valid, (d: ScatterPoint) => d.x) as [number, number];
  const yExtent = d3.extent(valid, (d: ScatterPoint) => d.y) as [number, number];
  const xScale = d3.scaleLinear().domain(xExtent).nice().range([margin.left, width - margin.right]);
  const yScale = d3.scaleLinear().domain(yExtent).nice().range([height - margin.bottom, margin.top]);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('class', 'scatter-svg');

  const axisBottom = d3.axisBottom(xScale).ticks(6);
  const axisLeft = d3.axisLeft(yScale).ticks(6);

  svg
    .append('g')
    .attr('transform', `translate(0, ${height - margin.bottom})`)
    .call(axisBottom as any);

  svg
    .append('g')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(axisLeft as any);

  svg
    .append('text')
    .attr('class', 'axis-label')
    .attr('x', width / 2)
    .attr('y', height - 10)
    .attr('text-anchor', 'middle')
    .text(labels.xLabel);

  svg
    .append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .text(labels.yLabel);

  svg
    .append('g')
    .attr('class', 'scatter-points')
    .selectAll<SVGCircleElement, ScatterPoint>('circle')
    .data(valid)
    .enter()
    .append('circle')
    .attr('cx', (d: ScatterPoint) => xScale(d.x))
    .attr('cy', (d: ScatterPoint) => yScale(d.y))
    .attr('r', 4)
    .attr('fill', '#1976d2')
    .attr('opacity', 0.8)
    .append('title')
    .text((d: ScatterPoint) => `${d.state}\n${labels.xLabel}: ${d.x.toFixed(2)}\n${labels.yLabel}: ${d.y.toFixed(2)}`);

  const meanX = d3.mean(valid, (d: ScatterPoint) => d.x) ?? 0;
  const meanY = d3.mean(valid, (d: ScatterPoint) => d.y) ?? 0;
  const varianceX = d3.mean(valid, (d: ScatterPoint) => Math.pow(d.x - meanX, 2)) ?? 0;
  const varianceY = d3.mean(valid, (d: ScatterPoint) => Math.pow(d.y - meanY, 2)) ?? 0;
  const covariance = d3.mean(valid, (d: ScatterPoint) => (d.x - meanX) * (d.y - meanY)) ?? 0;

  const slope = varianceX === 0 ? 0 : covariance / varianceX;
  const intercept = meanY - slope * meanX;
  const r = varianceX === 0 || varianceY === 0 ? 0 : covariance / Math.sqrt(varianceX * varianceY);

  const linePoints = [xScale.domain()[0], xScale.domain()[1]].map((x) => ({ x, y: slope * x + intercept }));
  svg
    .append('line')
    .attr('class', 'regression-line')
    .attr('x1', xScale(linePoints[0].x))
    .attr('y1', yScale(linePoints[0].y))
    .attr('x2', xScale(linePoints[1].x))
    .attr('y2', yScale(linePoints[1].y))
    .attr('stroke', '#d32f2f')
    .attr('stroke-width', 2)
    .attr('opacity', 0.8);

  const residuals = valid.map((d: ScatterPoint) => {
    const predicted = slope * d.x + intercept;
    return {
      state: d.state,
      actual: d.y,
      predicted,
      residual: d.y - predicted
    };
  });

  residuals.sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual));

  return { slope, intercept, r, residuals };
}
