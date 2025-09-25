export interface CancerStateMetrics {
  state: string;
  incidence_2019: number | null;
  incidence_2020: number | null;
  incidence_2021: number | null;
  incidence_2022: number | null;
  incidence_cagr_19_22: number | null;
}

export interface CuisineStateMetrics {
  state: string;
  dish_count: number;
  pct_veg: number | null;
  pct_sweet: number | null;
  avg_prep_time: number | null;
  avg_cook_time: number | null;
  pct_lentil_like: number | null;
  pct_red_meat_like: number | null;
  pct_poultry: number | null;
  pct_fish: number | null;
  pct_turmeric: number | null;
  ingredient_stats: Record<string, number>;
}

export interface JoinedStateMetrics {
  state: string;
  cancer: CancerStateMetrics | null;
  cuisine: CuisineStateMetrics | null;
}

export interface DerivedData {
  cancer: CancerStateMetrics[];
  cuisine: CuisineStateMetrics[];
  joined: JoinedStateMetrics[];
}

export interface IndiaTopology {
  type: string;
  objects: Record<string, unknown>;
  arcs: number[][][];
  transform?: {
    scale: [number, number];
    translate: [number, number];
  };
}
