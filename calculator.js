/**
 * calculator.js
 * CarbonMirror — Emission Calculation Engine
 * Pure functions only. No side effects, no DOM access.
 * All factors sourced from data/emission-factors.json
 */

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

/** Weeks per year */
const WEEKS_PER_YEAR = 52;
/** Days per year */
const DAYS_PER_YEAR = 365;

/** Delhi → Mumbai distance in km */
const DELHI_MUMBAI_KM = 1450;
/** Average CO₂ absorbed by one mature tree per year (kg) */
const TREE_ABSORPTION_KG = 21;
/** Average Indian household monthly electricity (kWh) */
const INDIA_HOUSEHOLD_KWH_MONTH = 96;
/** IEA India grid emission factor (kg CO₂/kWh) */
const INDIA_GRID_FACTOR = 0.708;
/** Average Indian household monthly CO₂ from electricity */
const INDIA_HOUSEHOLD_CO2_MONTH = INDIA_HOUSEHOLD_KWH_MONTH * INDIA_GRID_FACTOR; // ~68 kg
/** Average domestic flight CO₂ per km */
const DOMESTIC_FLIGHT_PER_KM = 0.255;
/** Average Mumbai → Delhi route for domestic flight analogy (km) */
const DELHI_MUMBAI_FLIGHT_KM = 1150;

/** India national average annual CO₂ per capita (kg) */
const INDIA_AVG_KG = 1900;
/** Global average annual CO₂ per capita (kg) */
const GLOBAL_AVG_KG = 4700;

// ─── TRANSPORT FACTORS (kg CO₂ per km) ────────────────────────────────────
const TRANSPORT_FACTORS = {
  none:          0.000,
  petrol_car:    0.192,
  diesel_car:    0.171,
  cng_car:       0.131,
  motorcycle:    0.103,
  ev_car:        0.088,
  cab_petrol:    0.192,
  // Public transit
  metro:         0.041,
  city_bus:      0.089,
  auto_rickshaw: 0.076,
  train_ir:      0.012,
};

/** Map select option value → public transit days/week */
const PUBLIC_TRANSIT_DAYS = { '0': 0, '1': 1.5, '3': 3.5, '5': 5, '7': 7 };

// ─── FOOD FACTORS ──────────────────────────────────────────────────────────
/** Serving size approximation in kg of food for meals */
const SERVING_KG = 0.15; // ~150g per serving

const FOOD_DIET_BASELINE = {
  vegan:          150,   // kg CO₂/year baseline
  vegetarian:     400,
  'non-veg-light': 650,
  'non-veg-regular': 950,
  'heavy-meat':   1400,
};

const CHICKEN_PER_SERVING_KG  = 9.9 * SERVING_KG;  // per serving
const RED_MEAT_PER_SERVING_KG = 39.2 * SERVING_KG; // per serving
const EGG_CO2_EACH            = 0.375;              // per egg
const DAIRY_CO2_PER_LITRE     = 3.2;
const FOOD_DELIVERY_CO2       = 0.4;                // per order (logistics only)
const DELIVERY_MEAL_AVG_CO2   = 2.5;                // per delivery meal content

// ─── ENERGY FACTORS ────────────────────────────────────────────────────────
const LPG_CO2_PER_CYLINDER = 42.36;                 // 14.2 kg × 2.983 kg CO₂/kg
const PNG_CO2_PER_KG       = 2.204;
const AC_CO2_PER_HR_1_5T   = 1.062;                 // 1.5 kW × 0.708
const AC_CO2_PER_HR_2T     = 1.416;
const SOLAR_OFFSET_RATIO   = { '0': 0, '1': 0.3, '2': 0.7 }; // fraction of electricity offset

// ─── SHOPPING FACTORS ──────────────────────────────────────────────────────
const CLOTHING_CO2_EACH       = 10;    // per garment (t-shirt avg)
const SMARTPHONE_CO2          = 70;    // per device
const LAPTOP_CO2              = 350;   // per device
const ONLINE_ORDER_PKG_CO2    = 0.5;   // per parcel
const LARGE_APPLIANCE_CO2     = 225;   // average per large appliance (TV, fridge, etc.)

// ─── DIGITAL FACTORS ───────────────────────────────────────────────────────
const STREAMING_HD_PER_HR     = 0.036;
const STREAMING_4K_PER_HR     = 0.072;
const STREAMING_SD_PER_HR     = 0.018;
const SOCIAL_MEDIA_PER_HR     = 0.015;
const VIDEO_CALL_PER_HR       = 0.157;
const CLOUD_STORAGE_PER_GB_MONTH = 0.003;
const GAMING_PER_HR           = 0.08;

// ─── TIER THRESHOLDS ───────────────────────────────────────────────────────
export const TIERS = {
  green:  { max: 1500,  label: 'Carbon Champion', icon: '🌱', colorVar: '--color-green-tier',  cssClass: 'tier--green'  },
  yellow: { min: 1500,  max: 3000, label: 'Average Citizen',  icon: '🌤️', colorVar: '--color-yellow-tier', cssClass: 'tier--yellow' },
  orange: { min: 3000,  max: 6000, label: 'Heavy Footprint',  icon: '⚠️', colorVar: '--color-orange-tier', cssClass: 'tier--orange' },
  red:    { min: 6000,             label: 'Climate Emergency', icon: '🔴', colorVar: '--color-red-tier',    cssClass: 'tier--red'    },
};

// ────────────────────────────────────────────────────────────────────────────
// CALCULATION FUNCTIONS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate annual transport emissions in kg CO₂.
 * @param {Object} inputs - Transport form inputs
 * @returns {{ kg: number, breakdown: Object }}
 */
export function calculateTransport(inputs) {
  const {
    vehicle     = 'none',
    kmPerWeek   = 80,
    publicDays  = '3',
    publicKmDay = 20,
    publicType  = 'metro',
    flights     = 2,
    flightKm    = 800,
  } = inputs;

  // Private vehicle
  const vehicleFactor  = TRANSPORT_FACTORS[vehicle] ?? 0;
  const vehicleKg      = vehicleFactor * Number(kmPerWeek) * WEEKS_PER_YEAR;

  // Public transit
  const publicDaysNum  = PUBLIC_TRANSIT_DAYS[String(publicDays)] ?? 3.5;
  const publicFactor   = TRANSPORT_FACTORS[publicType] ?? 0.041;
  const publicKg       = publicFactor * Number(publicKmDay) * publicDaysNum * (DAYS_PER_YEAR / 7);

  // Flights
  const flightKg       = Number(flights) * Number(flightKm) * DOMESTIC_FLIGHT_PER_KM;

  const totalKg = vehicleKg + publicKg + flightKg;

  return {
    kg: Math.round(totalKg),
    breakdown: {
      vehicle:   Math.round(vehicleKg),
      publicTransit: Math.round(publicKg),
      flights:   Math.round(flightKg),
    },
  };
}

/**
 * Calculate annual food emissions in kg CO₂.
 * @param {Object} inputs - Food form inputs
 * @returns {{ kg: number, breakdown: Object }}
 */
export function calculateFood(inputs) {
  const {
    dietType      = 'vegetarian',
    chickenPerWeek = 3,
    redMeatPerWeek = 1,
    dairyLitresDay = 0.7,
    eggsPerWeek   = 4,
    deliveryPerWeek = 4,
    wasteMultiplier = 1.15,
  } = inputs;

  const dietBaseline = FOOD_DIET_BASELINE[dietType] ?? 400;

  // Extra meat on top of diet baseline (additional servings beyond what diet accounts for)
  const chickenExtra = (dietType === 'vegan' || dietType === 'vegetarian')
    ? 0
    : Math.max(0, Number(chickenPerWeek) - getBaseServings(dietType, 'chicken'));
  const redMeatExtra = (dietType === 'vegan' || dietType === 'vegetarian')
    ? 0
    : Math.max(0, Number(redMeatPerWeek) - getBaseServings(dietType, 'redMeat'));

  const chickenKg   = chickenExtra * CHICKEN_PER_SERVING_KG * WEEKS_PER_YEAR;
  const redMeatKg   = redMeatExtra * RED_MEAT_PER_SERVING_KG * WEEKS_PER_YEAR;

  // If diet says non-veg, count ALL servings
  const chickenAllKg   = ['non-veg-light','non-veg-regular','heavy-meat'].includes(dietType)
    ? Number(chickenPerWeek) * CHICKEN_PER_SERVING_KG * WEEKS_PER_YEAR
    : 0;
  const redMeatAllKg   = ['non-veg-light','non-veg-regular','heavy-meat'].includes(dietType)
    ? Number(redMeatPerWeek) * RED_MEAT_PER_SERVING_KG * WEEKS_PER_YEAR
    : 0;

  const dairyKg     = Number(dairyLitresDay) * DAIRY_CO2_PER_LITRE * DAYS_PER_YEAR;
  const eggsKg      = Number(eggsPerWeek) * EGG_CO2_EACH * WEEKS_PER_YEAR;
  const deliveryKg  = Number(deliveryPerWeek) * (FOOD_DELIVERY_CO2 + DELIVERY_MEAL_AVG_CO2) * WEEKS_PER_YEAR;

  // For non-veg diets, we use the full servings already counted in baseline, so avoid double-count
  const meatKg = (chickenAllKg + redMeatAllKg) || (chickenKg + redMeatKg);

  const baseWithMeat = ['vegan','vegetarian'].includes(dietType)
    ? dietBaseline + dairyKg + eggsKg
    : meatKg + (dietBaseline * 0.4) + dairyKg + eggsKg; // 40% of baseline covers plant foods

  const totalBefore = baseWithMeat + deliveryKg;
  const totalKg     = totalBefore * Number(wasteMultiplier);

  return {
    kg: Math.round(totalKg),
    breakdown: {
      dietBase:    Math.round(dietBaseline),
      meat:        Math.round(meatKg),
      dairy:       Math.round(dairyKg),
      eggs:        Math.round(eggsKg),
      delivery:    Math.round(deliveryKg),
    },
  };
}

/**
 * Helper: how many meat servings are already "baked into" the diet baseline.
 * @param {string} dietType
 * @param {'chicken'|'redMeat'} type
 */
function getBaseServings(dietType, type) {
  const baseMap = {
    'non-veg-light':   { chicken: 2, redMeat: 0.5 },
    'non-veg-regular': { chicken: 4, redMeat: 1   },
    'heavy-meat':      { chicken: 5, redMeat: 3   },
  };
  return baseMap[dietType]?.[type] ?? 0;
}

/**
 * Calculate annual home energy emissions in kg CO₂.
 * @param {Object} inputs - Energy form inputs
 * @returns {{ kg: number, breakdown: Object }}
 */
export function calculateEnergy(inputs) {
  const {
    electricityKwh  = 150,
    lpgCylinders    = 0.5,
    cookingType     = 'lpg',
    acHrsDay        = 4,
    acMonths        = 5,
    solarLevel      = '0',
  } = inputs;

  // Grid electricity (monthly → annual)
  const solarOffset      = SOLAR_OFFSET_RATIO[String(solarLevel)] ?? 0;
  const netElecKwh       = Number(electricityKwh) * 12 * (1 - solarOffset);
  const electricityKg    = netElecKwh * INDIA_GRID_FACTOR;

  // Cooking
  let cookingKg = 0;
  if (cookingType === 'lpg') {
    cookingKg = Number(lpgCylinders) * LPG_CO2_PER_CYLINDER * 12;
  } else if (cookingType === 'png') {
    // ~8 kg PNG/month for average Indian family
    cookingKg = 8 * PNG_CO2_PER_KG * 12;
  } else if (cookingType === 'electric') {
    // Induction: ~30 kWh/month additional
    cookingKg = 30 * INDIA_GRID_FACTOR * 12;
  } else if (cookingType === 'biomass') {
    // Biomass (wood, dung) has very high GHG in India context — ~2.0x grid electricity equivalent
    cookingKg = 200; // approximate annual
  }

  // AC
  const acKg = Number(acHrsDay) * AC_CO2_PER_HR_1_5T * Number(acMonths) * 30;

  const totalKg = electricityKg + cookingKg + acKg;

  return {
    kg: Math.round(totalKg),
    breakdown: {
      electricity: Math.round(electricityKg),
      cooking:     Math.round(cookingKg),
      ac:          Math.round(acKg),
    },
  };
}

/**
 * Calculate annual shopping emissions in kg CO₂.
 * @param {Object} inputs - Shopping form inputs
 * @returns {{ kg: number, breakdown: Object }}
 */
export function calculateShopping(inputs) {
  const {
    newClothesMonth     = 3,
    smartphonesYear     = 0,
    laptopsYear         = 0,
    onlineOrdersWeek    = 3,
    largeAppliancesYear = 0,
  } = inputs;

  const clothingKg     = Number(newClothesMonth) * CLOTHING_CO2_EACH * 12;
  const phonesKg       = Number(smartphonesYear) * SMARTPHONE_CO2;
  const laptopsKg      = Number(laptopsYear) * LAPTOP_CO2;
  const onlineKg       = Number(onlineOrdersWeek) * ONLINE_ORDER_PKG_CO2 * WEEKS_PER_YEAR;
  const appliancesKg   = Number(largeAppliancesYear) * LARGE_APPLIANCE_CO2;

  const totalKg = clothingKg + phonesKg + laptopsKg + onlineKg + appliancesKg;

  return {
    kg: Math.round(totalKg),
    breakdown: {
      clothing:    Math.round(clothingKg),
      devices:     Math.round(phonesKg + laptopsKg),
      onlinePkg:   Math.round(onlineKg),
      appliances:  Math.round(appliancesKg),
    },
  };
}

/**
 * Calculate annual digital emissions in kg CO₂.
 * @param {Object} inputs - Digital form inputs
 * @returns {{ kg: number, breakdown: Object }}
 */
export function calculateDigital(inputs) {
  const {
    streamingHrsDay   = 3,
    streamingQuality  = 'hd',
    socialHrsDay      = 3,
    videoCallHrsDay   = 1,
    cloudGb           = 50,
    gamingHrsDay      = 0,
  } = inputs;

  const streamFactor = { sd: STREAMING_SD_PER_HR, hd: STREAMING_HD_PER_HR, '4k': STREAMING_4K_PER_HR }[streamingQuality] ?? STREAMING_HD_PER_HR;

  const streamingKg  = Number(streamingHrsDay) * streamFactor * DAYS_PER_YEAR;
  const socialKg     = Number(socialHrsDay) * SOCIAL_MEDIA_PER_HR * DAYS_PER_YEAR;
  const videoCallKg  = Number(videoCallHrsDay) * VIDEO_CALL_PER_HR * DAYS_PER_YEAR;
  const cloudKg      = Number(cloudGb) * CLOUD_STORAGE_PER_GB_MONTH * 12;
  const gamingKg     = Number(gamingHrsDay) * GAMING_PER_HR * DAYS_PER_YEAR;

  const totalKg = streamingKg + socialKg + videoCallKg + cloudKg + gamingKg;

  return {
    kg: Math.round(totalKg),
    breakdown: {
      streaming:  Math.round(streamingKg),
      social:     Math.round(socialKg),
      videoCalls: Math.round(videoCallKg),
      cloud:      Math.round(cloudKg),
      gaming:     Math.round(gamingKg),
    },
  };
}

/**
 * Aggregate all categories into a total with tier, analogies, and breakdown.
 * @param {{ transport, food, energy, shopping, digital }} results - Per-category results
 * @returns {{ totalKg, tier, tierInfo, breakdown, analogies, percentages }}
 */
export function getTotal(results) {
  const { transport, food, energy, shopping, digital } = results;

  const totalKg = (transport?.kg ?? 0) + (food?.kg ?? 0) + (energy?.kg ?? 0) +
                  (shopping?.kg ?? 0) + (digital?.kg ?? 0);

  const tier     = getTier(totalKg);
  const tierInfo = TIERS[tier];

  const breakdown = [
    { label: 'Transport',    icon: '🚗', kg: transport?.kg ?? 0 },
    { label: 'Food',         icon: '🍛', kg: food?.kg ?? 0 },
    { label: 'Home Energy',  icon: '⚡', kg: energy?.kg ?? 0 },
    { label: 'Shopping',     icon: '🛍', kg: shopping?.kg ?? 0 },
    { label: 'Digital',      icon: '📱', kg: digital?.kg ?? 0 },
  ];

  const analogies = getAnalogies(totalKg);

  const percentages = breakdown.map(item => ({
    ...item,
    pct: totalKg > 0 ? Math.round((item.kg / totalKg) * 100) : 0,
  }));

  return { totalKg, tier, tierInfo, breakdown, analogies, percentages };
}

/**
 * Determine tier from kg CO₂.
 * @param {number} kg
 * @returns {'green'|'yellow'|'orange'|'red'}
 */
export function getTier(kg) {
  if (kg < 1500) return 'green';
  if (kg < 3000) return 'yellow';
  if (kg < 6000) return 'orange';
  return 'red';
}

/**
 * Generate human-readable analogies from a CO₂ total.
 * @param {number} kg - Annual CO₂ in kg
 * @returns {Object} analogies
 */
export function getAnalogies(kg) {
  if (!kg || kg <= 0) {
    return {
      delhiMumbaiDrives:     0,
      treesNeeded:           0,
      electricityMonths:     0,
      domesticFlights:       0,
      vsIndiaAvgPct:         0,
      vsIndiaAvgLabel:       '—',
    };
  }

  const petrolCarFactor = TRANSPORT_FACTORS.petrol_car; // 0.192 kg/km
  const delhiMumbaiDrives = Math.round((kg / (DELHI_MUMBAI_KM * petrolCarFactor)) * 10) / 10;

  const treesNeeded      = Math.ceil(kg / TREE_ABSORPTION_KG);
  const electricityMonths = Math.round((kg / INDIA_HOUSEHOLD_CO2_MONTH) * 10) / 10;

  const flightCo2        = DELHI_MUMBAI_FLIGHT_KM * DOMESTIC_FLIGHT_PER_KM; // ~293 kg
  const domesticFlights  = Math.round((kg / flightCo2) * 10) / 10;

  const vsIndiaAvgPct    = Math.round(((kg - INDIA_AVG_KG) / INDIA_AVG_KG) * 100);
  const vsIndiaAvgLabel  = vsIndiaAvgPct > 0
    ? `${vsIndiaAvgPct}% more than India avg`
    : vsIndiaAvgPct < 0
      ? `${Math.abs(vsIndiaAvgPct)}% less than India avg`
      : 'Exactly at India avg';

  return {
    delhiMumbaiDrives,
    treesNeeded,
    electricityMonths,
    domesticFlights,
    vsIndiaAvgPct,
    vsIndiaAvgLabel,
  };
}

/**
 * Generate a personalized 5-step roadmap based on the user's breakdown.
 * @param {{ transport, food, energy, shopping, digital }} categoryResults
 * @param {number} totalKg
 * @returns {Array<{step, title, description, savingKg, savingInrMonth}>}
 */
export function generateRoadmap(categoryResults, totalKg) {
  const steps = [];

  const { transport, food, energy, shopping, digital } = categoryResults;

  // Step suggestions (ranked by impact)
  const transportKg = transport?.kg ?? 0;
  const foodKg      = food?.kg ?? 0;
  const energyKg    = energy?.kg ?? 0;
  const shoppingKg  = shopping?.kg ?? 0;
  const digitalKg   = digital?.kg ?? 0;

  const candidates = [
    {
      category: 'transport',
      kg: transportKg,
      title: '🚇 Switch to Public Transport',
      description: 'Replace 3 private vehicle days/week with metro or bus commuting.',
      savingKg: Math.round(transportKg * 0.35),
      savingInrMonth: Math.round((transportKg * 0.35 / 12) * 5), // ~₹5 per kg saved
    },
    {
      category: 'food',
      kg: foodKg,
      title: '🌱 Go Vegetarian 4 Days/Week',
      description: 'Swap meat for dal, paneer, tofu, and vegetables on 4 days. High impact, low effort.',
      savingKg: Math.round(foodKg * 0.28),
      savingInrMonth: Math.round((foodKg * 0.28 / 12) * 3), // food savings are modest in ₹
    },
    {
      category: 'energy',
      kg: energyKg,
      title: '⭐ Upgrade to 5-Star Appliances',
      description: 'Switch your AC and fridge to BEE 5-star rated models. Reduces energy use by 30%.',
      savingKg: Math.round(energyKg * 0.25),
      savingInrMonth: Math.round((energyKg * 0.25 / 12) * 8), // ₹8 per unit saved
    },
    {
      category: 'shopping',
      kg: shoppingKg,
      title: '👕 Buy Half as Many New Clothes',
      description: 'Reduce new garment purchases by 50%. Swap, thrift, or repair instead.',
      savingKg: Math.round(shoppingKg * 0.4),
      savingInrMonth: Math.round((shoppingKg * 0.4 / 12) * 15), // direct money saved
    },
    {
      category: 'digital',
      kg: digitalKg,
      title: '📱 Drop Streaming Quality to HD',
      description: 'Switch from 4K to HD and reduce daily streaming by 1 hour. Easy win with no lifestyle loss.',
      savingKg: Math.round(digitalKg * 0.35),
      savingInrMonth: Math.round((digitalKg * 0.35 / 12) * 2),
    },
    {
      category: 'transport',
      kg: transportKg,
      title: '☀️ Install Rooftop Solar',
      description: 'A 2 kW rooftop system covers 70%+ of a typical Indian family\'s electricity needs.',
      savingKg: Math.round(energyKg * 0.55),
      savingInrMonth: Math.round((energyKg * 0.55 / 12) * 8),
    },
  ];

  // Sort by saving potential, take top 5
  candidates.sort((a, b) => b.savingKg - a.savingKg);

  return candidates.slice(0, 5).map((c, i) => ({
    step: i + 1,
    title: c.title,
    description: c.description,
    savingKg: c.savingKg,
    savingInrMonth: c.savingInrMonth,
    category: c.category,
  }));
}

/**
 * Format a kg number for display (e.g. 1234 → "1,234" or "1.2T")
 * @param {number} kg
 * @param {boolean} [short] - Use short form (T for tonnes)
 */
export function formatKg(kg, short = false) {
  if (short && kg >= 1000) {
    return (kg / 1000).toFixed(1) + 'T';
  }
  return Math.round(kg).toLocaleString('en-IN');
}

/**
 * Animated number counter (pure utility, no DOM side effect in calculator.js)
 * Returns a generator that yields values from start to end over steps.
 * @param {number} start
 * @param {number} end
 * @param {number} steps
 */
export function* numberCounter(start, end, steps = 60) {
  const diff = end - start;
  for (let i = 1; i <= steps; i++) {
    // Ease out cubic
    const t = i / steps;
    const ease = 1 - Math.pow(1 - t, 3);
    yield Math.round(start + diff * ease);
  }
}
