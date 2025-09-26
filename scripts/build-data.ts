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

type ArchanaFoodRow = {
  recipe_name?: string;
  diet?: string;
  prep_time_mins?: string;
  cook_time_mins?: string;
  course?: string;
  cuisine?: string;
  translated_ingredients?: string;
};

type LegacyFoodRow = {
  name?: string;
  ingredients?: string;
  diet?: string;
  flavor_profile?: string;
  prep_time?: string;
  cook_time?: string;
  state?: string;
  course?: string;
};

type ManualFoodRow = {
  state: string;
  recipe_name: string;
  diet: string;
  is_sweet?: boolean;
  prep_time_mins?: number;
  cook_time_mins?: number;
  ingredients: string[];
};

const ROOT = path.resolve(process.cwd());
const DERIVED = path.join(ROOT, 'public', 'derived');
fs.mkdirSync(DERIVED, { recursive: true });

const STATE_POPULATION_2021: Record<string, number> = {
  'Andaman and Nicobar Islands': 419_978,
  'Andhra Pradesh': 53_903_393,
  'Arunachal Pradesh': 1_570_458,
  Assam: 35_607_039,
  Bihar: 127_403_751,
  Chandigarh: 1_184_743,
  Chhattisgarh: 29_436_231,
  'Dadra and Nagar Haveli and Daman and Diu': 867_846,
  Delhi: 19_814_000,
  Goa: 1_586_250,
  Gujarat: 63_872_399,
  Haryana: 28_902_198,
  'Himachal Pradesh': 7_304_787,
  Jharkhand: 38_471_306,
  Karnataka: 67_562_686,
  Kerala: 35_699_443,
  'Madhya Pradesh': 85_358_965,
  Maharashtra: 124_904_071,
  Manipur: 3_117_011,
  Meghalaya: 3_366_710,
  Mizoram: 1_261_231,
  Nagaland: 2_249_695,
  Odisha: 46_356_334,
  Puducherry: 1_504_000,
  Punjab: 30_141_373,
  Rajasthan: 81_032_689,
  Sikkim: 690_251,
  'Tamil Nadu': 77_841_267,
  Telangana: 37_173_107,
  Tripura: 4_169_794,
  'Uttar Pradesh': 237_882_725,
  Uttarakhand: 11_250_858,
  'West Bengal': 100_043_676,
  'Jammu and Kashmir': 13_635_010,
  Ladakh: 297_419,
  Lakshadweep: 73_199,
  'Andaman & Nicobar Islands': 419_978
};

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

const SWEET_NAME_KEYWORDS = [
  'sweet',
  'halwa',
  'laddu',
  'ladoo',
  'barfi',
  'burfi',
  'kheer',
  'payasam',
  'peda',
  'rasgulla',
  'rasmalai',
  'kesari',
  'jalebi',
  'sheera',
  'poli',
  'mithai',
  'malpua',
  'gulab jamun',
  'sandesh',
  'shrikhand',
  'ghewar',
  'modak',
  'kulfi',
  'puran poli'
];

const SWEET_INGREDIENT_KEYWORDS = [
  'sugar',
  'jaggery',
  'honey',
  'condensed milk',
  'khoya',
  'mawa',
  'rabdi',
  'gud',
  'treacle',
  'molasses',
  'palm jaggery',
  'dates',
  'khoa'
];

const CUISINE_TO_STATE: Array<[RegExp, string]> = [
  [/\bandhra\b|rayalaseema|nellore|guntur/, 'Andhra Pradesh'],
  [/\btelangana\b|hyderabadi|nizam/, 'Telangana'],
  [/\bbengal\b|\bbengali\b|kolkata|calcutta/, 'West Bengal'],
  [/\bodia\b|\boriya\b|\bodisha\b|cuttack|bhubaneswar/, 'Odisha'],
  [/\bassam\b|\bassamese\b|ahom|bihu/, 'Assam'],
  [/\bbihar\b|\bbihari\b|magahi/, 'Bihar'],
  [/\barunachal\b|monpa|adi|nyishi/, 'Arunachal Pradesh'],
  [/\bchh?attisgarh\b|bastar/, 'Chhattisgarh'],
  [/\bgoa\b|\bgoan\b/, 'Goa'],
  [/\bgujarat\b|\bgujarati\b|kathiyawadi|kathiawadi|surti/, 'Gujarat'],
  [/\bharyana\b|haryanvi/, 'Haryana'],
  [/\bhimachal\b|pahari|kangra/, 'Himachal Pradesh'],
  [/\bjharkhand\b|chota nagpur/, 'Jharkhand'],
  [/\bkarnataka\b|mangalorean|udupi|coorg|kodava|malnad|coastal karnataka|north karnataka|south karnataka|mysore/, 'Karnataka'],
  [/\bkerala\b|malabar|onam|nadan/, 'Kerala'],
  [/\bmadhya pradesh\b|malwa|bagheli|baghelkhand|mahakoshal|bhopal|indore/, 'Madhya Pradesh'],
  [/\bmaharashtra\b|maharashtrian|konkan|malvani|vidarbha|kolhapuri|parsi/, 'Maharashtra'],
  [/\bmanipur\b|manipuri|meitei/, 'Manipur'],
  [/\bmeghalaya\b|khasi|jaintia|garo/, 'Meghalaya'],
  [/\bmizoram\b|mizo/, 'Mizoram'],
  [/\bnagaland\b|\bnaga\b/, 'Nagaland'],
  [/\bsikkim\b|lepcha|bhutia/, 'Sikkim'],
  [/\btamil\b|chettinad|kongunadu|madurai|tirunelveli/, 'Tamil Nadu'],
  [/\buttar pradesh\b|awadhi|lucknowi|banarasi|kashi/, 'Uttar Pradesh'],
  [/\buttarakhand\b|uttarakhand\b|kumaon|garhwal|garhwali/, 'Uttarakhand'],
  [/\bpunjab\b|punjabi|amritsar/, 'Punjab'],
  [/\brajasthan\b|rajasthani|marwari|jaipuri|jodhpuri/, 'Rajasthan'],
  [/\bdelhi\b|dilli/, 'Delhi'],
  [/\bchandigarh\b/, 'Chandigarh'],
  [/\bpuducherry\b|pondicherry/, 'Puducherry'],
  [/\bandaman\b|nicobar|car nicobar/, 'Andaman and Nicobar Islands'],
  [/\blakshadweep\b|laccadive|minicoy/, 'Lakshadweep'],
  [/\bdadra\b|nagar haveli|daman|\bdiu\b/, 'Dadra and Nagar Haveli and Daman and Diu'],
  [/\bladakh\b|ladakhi/, 'Ladakh'],
  [/\bkashmir\b|kashmiri|kashmiri pandit/, 'Jammu and Kashmir'],
  [/\btripura\b|tripuri|kokborok/, 'Tripura'],
  [/\bgoan\b/, 'Goa'],
  [/\bkonkani\b/, 'Goa'],
  [/\bharyana\b/, 'Haryana'],
  [/\bbastar\b/, 'Chhattisgarh'],
  [/\bhimachali\b/, 'Himachal Pradesh']
];

function normalizeStateText(label: string) {
  return label
    .toLowerCase()
    .replace(/recipes?/g, '')
    .replace(/cuisine/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferStateFromText(rawText: string | undefined | null): string | null {
  if (!rawText) return null;
  const normalized = normalizeStateText(rawText);
  if (!normalized) return null;
  for (const [pattern, state] of CUISINE_TO_STATE) {
    if (pattern.test(normalized)) {
      return state;
    }
  }
  return null;
}

function classifyDiet(rawDiet: string | undefined | null): 'vegetarian' | 'non-vegetarian' | null {
  if (!rawDiet) return null;
  const diet = rawDiet.toLowerCase();
  if (diet.includes('non')) return 'non-vegetarian';
  if (diet.includes('egg')) return 'non-vegetarian';
  if (diet.includes('veg')) return 'vegetarian';
  return null;
}

function detectSweetness(
  name: string,
  course: string | undefined,
  tokens: string[],
  rawIngredients: string
): boolean {
  const courseLower = course?.toLowerCase() ?? '';
  if (courseLower.includes('dessert') || courseLower.includes('sweet')) return true;
  const lowerName = name.toLowerCase();
  if (SWEET_NAME_KEYWORDS.some((kw) => lowerName.includes(kw))) return true;
  const rawLower = rawIngredients.toLowerCase();
  if (SWEET_INGREDIENT_KEYWORDS.some((kw) => rawLower.includes(kw))) {
    return true;
  }
  if (tokens.some((token) => SWEET_INGREDIENT_KEYWORDS.some((kw) => kw.includes(' ') ? false : token.includes(kw)))) {
    return true;
  }
  return false;
}

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
const RED_MEAT_TERMS = ['mutton', 'lamb', 'pork', 'beef', 'yak'];
const POULTRY_TERMS = ['chicken', 'duck'];
const FISH_TERMS = ['fish', 'prawn', 'prawns', 'shrimp', 'tuna', 'pomfret', 'crab', 'seafood'];
const TURMERIC_TERMS = ['turmeric', 'haldi'];
const NON_VEG_TERMS = ['chicken', 'mutton', 'lamb', 'pork', 'beef', 'fish', 'prawn', 'prawns', 'shrimp', 'egg', 'eggs', 'crab', 'tuna', 'clam'];

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
  const archanaCSV = readCSV(
    path.join(ROOT, 'data', 'archanaskitchen_recipes.csv')
  ) as unknown as ArchanaFoodRow[];
  const legacyCSV = readCSV(path.join(ROOT, 'data', 'legacy_indian_food.csv')) as unknown as LegacyFoodRow[];
  const manualJSON = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'manual_ut_recipes.json'), 'utf8')
  ) as ManualFoodRow[];

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
      population: STATE_POPULATION_2021[state] ?? STATE_POPULATION_2021[rawState] ?? null,
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
    const population = bucket.population ?? null;
    for (const year of [2019, 2020, 2021, 2022] as const) {
      const incidenceValue = bucket[`incidence_${year}`];
      bucket[`incidence_per_100k_${year}`] =
        incidenceValue != null && population
          ? (incidenceValue / population) * 100_000
          : null;
    }
  }
  const cancerRows = Object.values(cancerByState).sort((a, b) => a.state.localeCompare(b.state));
  const missingPopulation = cancerRows.filter((row) => row.population == null).map((row) => row.state);
  if (missingPopulation.length) {
    throw new Error(`Missing population for states: ${missingPopulation.join(', ')}`);
  }
  fs.writeFileSync(path.join(DERIVED, 'cancer_by_state.json'), JSON.stringify(cancerRows, null, 2));

  const cuisineAcc: Record<
    string,
    {
      state: string;
      dish_count: number;
      veg: number;
      sweet: number;
      prep_sum: number;
      prep_n: number;
      cook_sum: number;
      cook_n: number;
      lentil_like: number;
      red_meat_like: number;
      poultry: number;
      fish: number;
      turmeric: number;
      ingredient_stats: Map<string, number>;
    }
  > = {};

  const addObservation = (
    stateRaw: string,
    details: {
      diet: 'vegetarian' | 'non-vegetarian' | null;
      sweet: boolean;
      prep: number | null;
      cook: number | null;
      tokens: string[];
    }
  ) => {
    const state = norm(stateRaw);
    if (!state || state === '-1') return;
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
    const hasAnimalProtein = details.tokens.some((token) =>
      NON_VEG_TERMS.some((term) => token.includes(term))
    );
    const isVegetarian = details.diet === 'vegetarian' && !hasAnimalProtein;
    if (isVegetarian) bucket.veg += 1;
    if (details.sweet) bucket.sweet += 1;
    if (details.prep != null) {
      bucket.prep_sum += details.prep;
      bucket.prep_n += 1;
    }
    if (details.cook != null) {
      bucket.cook_sum += details.cook;
      bucket.cook_n += 1;
    }
    if (details.tokens.length) {
      const uniqueTokens = Array.from(new Set(details.tokens));
      if (anyMention(uniqueTokens, LENTIL_TERMS)) bucket.lentil_like += 1;
      if (anyMention(uniqueTokens, RED_MEAT_TERMS)) bucket.red_meat_like += 1;
      if (anyMention(uniqueTokens, POULTRY_TERMS)) bucket.poultry += 1;
      if (anyMention(uniqueTokens, FISH_TERMS)) bucket.fish += 1;
      if (anyMention(uniqueTokens, TURMERIC_TERMS)) bucket.turmeric += 1;
      for (const token of uniqueTokens) {
        const prev = bucket.ingredient_stats.get(token) ?? 0;
        bucket.ingredient_stats.set(token, prev + 1);
      }
    }
  };

  for (const row of archanaCSV) {
    const stateFromCuisine =
      inferStateFromText(row.cuisine) || inferStateFromText(row.recipe_name) || inferStateFromText(row.course);
    if (!stateFromCuisine) continue;
    const name = (row.recipe_name ?? '').trim();
    if (!name) continue;
    const diet = classifyDiet(row.diet);
    const prep = toNum(row.prep_time_mins);
    const cook = toNum(row.cook_time_mins);
    const ingredientsRaw = (row.translated_ingredients ?? '').trim();
    const tokens = tokenizeIngredients(ingredientsRaw);
    const sweet = detectSweetness(name, row.course, tokens, ingredientsRaw);
    addObservation(stateFromCuisine, { diet, sweet, prep, cook, tokens });
  }

  for (const row of legacyCSV) {
    const state = (row.state ?? '').trim();
    if (!state) continue;
    const name = (row.name ?? '').trim();
    const diet = classifyDiet(row.diet);
    const prep = toNum(row.prep_time);
    const cook = toNum(row.cook_time);
    const ingredientsRaw = row.ingredients ?? '';
    const tokens = tokenizeIngredients(ingredientsRaw);
    const flavor = (row.flavor_profile ?? '').trim().toLowerCase();
    const sweet = flavor === 'sweet' || detectSweetness(name, row.course, tokens, ingredientsRaw);
    addObservation(state, { diet, sweet, prep, cook, tokens });
  }

  for (const entry of manualJSON) {
    const ingredientsRaw = entry.ingredients.join(', ');
    const tokens = tokenizeIngredients(ingredientsRaw);
    const diet = classifyDiet(entry.diet);
    const sweet = entry.is_sweet ?? detectSweetness(entry.recipe_name, undefined, tokens, ingredientsRaw);
    const prep = entry.prep_time_mins ?? null;
    const cook = entry.cook_time_mins ?? null;
    addObservation(entry.state, { diet, sweet, prep, cook, tokens });
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
