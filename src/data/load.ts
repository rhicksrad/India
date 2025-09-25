import type { CancerStateMetrics, CuisineStateMetrics, JoinedStateMetrics, DerivedData, IndiaTopology } from './types';

const baseUrl = (() => {
  const base = import.meta.env.BASE_URL ?? '/';
  return base.startsWith('http') ? base : `${window.location.origin}${base}`;
})();

const resolvePublicPath = (relative: string) => new URL(relative, baseUrl).toString();

async function fetchJSON<T>(relative: string): Promise<T> {
  const res = await fetch(resolvePublicPath(relative));
  if (!res.ok) {
    throw new Error(`Failed to load ${relative}: ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface AppData extends DerivedData {
  topology: IndiaTopology;
}

export async function loadAppData(): Promise<AppData> {
  const [cancer, cuisine, joined, topology] = await Promise.all([
    fetchJSON<CancerStateMetrics[]>('derived/cancer_by_state.json'),
    fetchJSON<CuisineStateMetrics[]>('derived/cuisine_by_state.json'),
    fetchJSON<JoinedStateMetrics[]>('derived/joined_state_metrics.json'),
    fetchJSON<IndiaTopology>('geo/india_states.topo.json')
  ]);

  return { cancer, cuisine, joined, topology };
}
