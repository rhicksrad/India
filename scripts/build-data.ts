import fs from 'node:fs';
import path from 'node:path';
import { csvParse } from 'd3-dsv';

type CancerRow = {
  ['State/UT']: string;
  ['2019']?: string;
  ['2020']?: string;
  ['2021']?: string;
  ['2022']?: string;
};

type FoodRow = {
  state?: string;
  ingredients?: string;
  diet?: string;
  flavor_profile?: string;
  prep_time?: string;
  cook_time?: string;
};

const ROOT = path.resolve(process.cwd());
const DERIVED = path.join(ROOT, 'public', 'derived');
fs.mkdirSync(DERIVED, { recursive: true });

const normMap: Record<string, string> = {
  'NCT of Delhi': 'Delhi',
  'National Capital Territory of Delhi': 'Delhi',
  'Delhi (NCT)': 'Delhi',
  'Uttaranchal': 'Uttarakhand',
  'Uttar Pradesh': 'Uttar Pradesh',
  'Jammu & Kashmir': 'Jammu and Kashmir',
  'Jammu and Kashmir': 'Jammu and Kashmir',
  'Dadra and Nagar Haveli and Daman and Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'Dadra and Nagar Haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'Daman': 'Dadra and Nagar Haveli and Daman and Diu',
  'Daman and Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'Andaman & Nicobar Islands': 'Andaman and Nicobar Islands',
  'Andaman and Nicobar Islands': 'Andaman and Nicobar Islands',
  'Pondicherry': 'Puducherry',
  'Puducherry': 'Puducherry',
  'Orissa': 'Odisha',
  'Karnataka': 'Karnataka',
  'Tamilnadu': 'Tamil Nadu',
  'Telangana': 'Telangana',
  'Chattisgarh': 'Chhattisgarh',
  'Chhatisgarh': 'Chhattisgarh',
  'Lakshadweep Islands': 'Lakshadweep',
  'Lakshadweep': 'Lakshadweep',
  'Arunachal': 'Arunachal Pradesh',
  'Maharastra': 'Maharashtra',
  'Madhya Pradesh': 'Madhya Pradesh',
  'Ladakh': 'Ladakh'
};

const norm = (s: string) => {
  const trimmed = s.trim();
  return (normMap[trimmed] ?? trimmed) || trimmed;
};

const readCSV = (p: string) => csvParse(fs.readFileSync(p, 'utf8'));

function cagr(v0: number, v1: number, years: number) {
  if (!isFinite(v0) || !isFinite(v1) || v0 <= 0 || years <= 0) return null;
  return Math.pow(v1 / v0, 1 / years) - 1;
}

function tokenizeIngredients(s: string): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .split(',')
    .map((part) => part.replace(/\([^)]*\)/g, '').trim())
    .map((part) => part.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const LENTIL_TERMS = ['lentil', 'dal', 'toor', 'masoor', 'moong', 'chana', 'chickpea', 'arhar', 'urad'];
const RED_MEAT_TERMS = ['mutton', 'lamb', 'pork', 'beef'];
const POULTRY_TERMS = ['chicken'];
const FISH_TERMS = ['fish'];
const TURMERIC_TERMS = ['turmeric', 'haldi'];

function anyMention(tokens: string[], terms: string[]) {
  return tokens.some((token) => terms.some((term) => token.includes(term)));
}

function toNum(x?: string) {
  if (x == null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function main() {
  const cancerCSV = readCSV(path.join(ROOT, 'data', 'cancer_incidence_india.csv')) as unknown as CancerRow[];
  const foodCSV = readCSV(path.join(ROOT, 'data', 'indian_food.csv')) as unknown as FoodRow[];

  const cancerByState: Record<string, any> = {};
  for (const row of cancerCSV) {
    const rawState = String(row['State/UT'] ?? '').trim();
    if (!rawState) continue;
    const state = norm(rawState);
    const v2019 = toNum(row['2019']);
    const v2020 = toNum(row['2020']);
    const v2021 = toNum(row['2021']);
    const v2022 = toNum(row['2022']);
    const bucket = (cancerByState[state] ??= {
      state,
      incidence_2019: 0,
      incidence_2020: 0,
      incidence_2021: 0,
      incidence_2022: 0
    });
    if (v2019 != null) bucket.incidence_2019 += v2019;
    else bucket.incidence_2019 = null;
    if (v2020 != null) bucket.incidence_2020 += v2020;
    else bucket.incidence_2020 = null;
    if (v2021 != null) bucket.incidence_2021 += v2021;
    else bucket.incidence_2021 = null;
    if (v2022 != null) bucket.incidence_2022 += v2022;
    else bucket.incidence_2022 = null;
  }
  for (const state of Object.keys(cancerByState)) {
    const bucket = cancerByState[state];
    const v2019 = bucket.incidence_2019;
    const v2022 = bucket.incidence_2022;
    bucket.incidence_cagr_19_22 = v2019 != null && v2022 != null ? cagr(v2019, v2022, 3) : null;
  }
  const cancerRows = Object.values(cancerByState).sort((a, b) => a.state.localeCompare(b.state));
  fs.writeFileSync(path.join(DERIVED, 'cancer_by_state.json'), JSON.stringify(cancerRows, null, 2));

  const cuisineAcc: Record<string, any> = {};
  for (const row of foodCSV) {
    const stateRaw = (row.state ?? '').trim();
    if (!stateRaw) continue;
    const state = norm(stateRaw);
    if (!state || state === '-1') continue;
    const diet = (row.diet ?? '').trim().toLowerCase();
    const flavor = (row.flavor_profile ?? '').trim().toLowerCase();
    const prep = toNum(row.prep_time);
    const cook = toNum(row.cook_time);
    const tokens = tokenizeIngredients(row.ingredients ?? '');

    const bucket = (cuisineAcc[state] ??= {
      state,
      dish_count: 0,
      veg: 0,
      sweet: 0,
      prep_sum: 0,
      prep_n: 0,
      cook_sum: 0,
      cook_n: 0,
      lentil_like: 0,
      red_meat_like: 0,
      poultry: 0,
      fish: 0,
      turmeric: 0,
      ingredient_stats: new Map<string, number>()
    });

    bucket.dish_count += 1;
    if (diet === 'vegetarian') bucket.veg += 1;
    if (flavor === 'sweet') bucket.sweet += 1;
    if (prep != null) {
      bucket.prep_sum += prep;
      bucket.prep_n += 1;
    }
    if (cook != null) {
      bucket.cook_sum += cook;
      bucket.cook_n += 1;
    }
    if (tokens.length) {
      if (anyMention(tokens, LENTIL_TERMS)) bucket.lentil_like += 1;
      if (anyMention(tokens, RED_MEAT_TERMS)) bucket.red_meat_like += 1;
      if (anyMention(tokens, POULTRY_TERMS)) bucket.poultry += 1;
      if (anyMention(tokens, FISH_TERMS)) bucket.fish += 1;
      if (anyMention(tokens, TURMERIC_TERMS)) bucket.turmeric += 1;
      for (const token of tokens) {
        const prev = bucket.ingredient_stats.get(token) ?? 0;
        bucket.ingredient_stats.set(token, prev + 1);
      }
    }
  }

  const cuisineRows = Object.values(cuisineAcc)
    .map((bucket) => {
      const ingredient_stats = Object.fromEntries(
        [...bucket.ingredient_stats.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      );
      return {
        state: bucket.state,
        dish_count: bucket.dish_count,
        pct_veg: bucket.dish_count ? bucket.veg / bucket.dish_count : null,
        pct_sweet: bucket.dish_count ? bucket.sweet / bucket.dish_count : null,
        avg_prep_time: bucket.prep_n ? bucket.prep_sum / bucket.prep_n : null,
        avg_cook_time: bucket.cook_n ? bucket.cook_sum / bucket.cook_n : null,
        pct_lentil_like: bucket.dish_count ? bucket.lentil_like / bucket.dish_count : null,
        pct_red_meat_like: bucket.dish_count ? bucket.red_meat_like / bucket.dish_count : null,
        pct_poultry: bucket.dish_count ? bucket.poultry / bucket.dish_count : null,
        pct_fish: bucket.dish_count ? bucket.fish / bucket.dish_count : null,
        pct_turmeric: bucket.dish_count ? bucket.turmeric / bucket.dish_count : null,
        ingredient_stats
      };
    })
    .sort((a, b) => a.state.localeCompare(b.state));

  fs.writeFileSync(path.join(DERIVED, 'cuisine_by_state.json'), JSON.stringify(cuisineRows, null, 2));

  const cuisineByState = new Map(cuisineRows.map((row) => [row.state, row]));
  const allStates = new Set<string>([...Object.keys(cancerByState), ...cuisineRows.map((row) => row.state)]);
  const joinedRows = [...allStates]
    .sort((a, b) => a.localeCompare(b))
    .map((state) => ({
      state,
      cancer: cancerByState[state] ?? null,
      cuisine: cuisineByState.get(state) ?? null
    }));

  fs.writeFileSync(path.join(DERIVED, 'joined_state_metrics.json'), JSON.stringify(joinedRows, null, 2));

  for (const file of ['cancer_by_state.json', 'cuisine_by_state.json', 'joined_state_metrics.json']) {
    const size = fs.statSync(path.join(DERIVED, file)).size;
    if (size > 1_000_000) {
      throw new Error(`${file} too large: ${size} bytes`);
    }
  }
}

main();
