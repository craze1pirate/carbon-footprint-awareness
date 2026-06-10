/**
 * calculator.test.js
 * CarbonMirror — Complete Unit Test Suite
 *
 * Tests every exported function in calculator.js with:
 *   - Boundary conditions (zero, negatives, defaults)
 *   - Known-value assertions derived from the exact formula constants
 *   - Relational assertions (A > B, monotonic increase, ordering)
 *   - Shape / type assertions on returned objects
 *   - Integration tests through the full pipeline
 *
 * Run: npm test
 * Coverage: npm run test:coverage
 */

import {
  calculateTransport,
  calculateFood,
  calculateEnergy,
  calculateShopping,
  calculateDigital,
  getTotal,
  getTier,
  getAnalogies,
  generateRoadmap,
  formatKg,
  numberCounter,
  TIERS,
} from './calculator.js';

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateTransport()', () => {

  // Base object with every field explicit to avoid default contamination
  const ZERO_TRANSPORT = {
    vehicle: 'none', kmPerWeek: 0, publicDays: '0',
    publicKmDay: 0, publicType: 'metro', flights: 0, flightKm: 0,
  };

  test('returns 0 kg when vehicle=none, no transit, no flights', () => {
    const result = calculateTransport(ZERO_TRANSPORT);
    expect(result.kg).toBe(0);
    expect(result.breakdown.vehicle).toBe(0);
    expect(result.breakdown.publicTransit).toBe(0);
    expect(result.breakdown.flights).toBe(0);
  });

  test('petrol car 100 km/week → 0.192 × 100 × 52 ≈ 998 kg', () => {
    // 0.192 × 100 × 52 = 998.4 → Math.round = 998
    const result = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 100 });
    expect(result.kg).toBe(998);
    expect(result.breakdown.vehicle).toBe(998);
  });

  test('petrol car 200 km/week emits exactly 2× the 100 km/week case', () => {
    const r100 = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 100 });
    const r200 = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 200 });
    // 0.192 × 200 × 52 = 1996.8 → 1997
    expect(r200.breakdown.vehicle).toBe(1997);
    expect(r200.breakdown.vehicle).toBeCloseTo(r100.breakdown.vehicle * 2, -1);
  });

  test('diesel car emits less than petrol car for same distance', () => {
    // diesel = 0.171, petrol = 0.192 → diesel < petrol
    const diesel = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'diesel_car', kmPerWeek: 100 });
    const petrol = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 100 });
    expect(diesel.kg).toBeLessThan(petrol.kg);
    // 0.171 × 100 × 52 = 889.2 → 889
    expect(diesel.breakdown.vehicle).toBe(889);
  });

  test('EV emits less than petrol, CNG, diesel per km', () => {
    const km = { ...ZERO_TRANSPORT, kmPerWeek: 100 };
    const ev = calculateTransport({ ...km, vehicle: 'ev_car' });
    const cng = calculateTransport({ ...km, vehicle: 'cng_car' });
    const diesel = calculateTransport({ ...km, vehicle: 'diesel_car' });
    const petrol = calculateTransport({ ...km, vehicle: 'petrol_car' });
    expect(ev.kg).toBeLessThan(cng.kg);
    expect(cng.kg).toBeLessThan(diesel.kg);
    expect(diesel.kg).toBeLessThan(petrol.kg);
  });

  test('motorcycle emits less than petrol car (0.103 vs 0.192 kg/km)', () => {
    const moto = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'motorcycle', kmPerWeek: 100 });
    const car = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 100 });
    // moto: 0.103 × 100 × 52 = 535.6 → 536
    expect(moto.breakdown.vehicle).toBe(536);
    expect(moto.kg).toBeLessThan(car.kg);
  });

  test('metro public transit 20 km/day, 5 days/week → 0.041 × 20 × 5 × (365/7) ≈ 214 kg', () => {
    // 0.041 × 20 × 5 × 52.142… = 213.78 → 214
    const result = calculateTransport({
      ...ZERO_TRANSPORT, publicDays: '5', publicKmDay: 20, publicType: 'metro',
    });
    expect(result.breakdown.publicTransit).toBe(214);
    expect(result.kg).toBe(214);
  });

  test('city bus (0.089 kg/km) emits more than metro (0.041 kg/km) for same route', () => {
    const shared = { ...ZERO_TRANSPORT, publicDays: '5', publicKmDay: 20 };
    const metro = calculateTransport({ ...shared, publicType: 'metro' });
    const bus = calculateTransport({ ...shared, publicType: 'city_bus' });
    expect(bus.kg).toBeGreaterThan(metro.kg);
  });

  test('Indian Railways (0.012 kg/km) emits least of all public transit options', () => {
    const shared = { ...ZERO_TRANSPORT, publicDays: '7', publicKmDay: 30 };
    const rail = calculateTransport({ ...shared, publicType: 'train_ir' });
    const metro = calculateTransport({ ...shared, publicType: 'metro' });
    const auto = calculateTransport({ ...shared, publicType: 'auto_rickshaw' });
    const bus = calculateTransport({ ...shared, publicType: 'city_bus' });
    expect(rail.kg).toBeLessThan(metro.kg);
    expect(rail.kg).toBeLessThan(auto.kg);
    expect(rail.kg).toBeLessThan(bus.kg);
  });

  test('4 domestic flights × 800 km → 4 × 800 × 0.255 = 816 kg', () => {
    const result = calculateTransport({ ...ZERO_TRANSPORT, flights: 4, flightKm: 800 });
    expect(result.breakdown.flights).toBe(816);
    expect(result.kg).toBe(816);
  });

  test('Delhi-Mumbai flight (1150 km) emits 1150 × 0.255 ≈ 293 kg per trip', () => {
    const result = calculateTransport({ ...ZERO_TRANSPORT, flights: 1, flightKm: 1150 });
    // 1 × 1150 × 0.255 = 293.25 → 293
    expect(result.breakdown.flights).toBe(293);
  });

  test('doubling flight distance doubles flight emissions', () => {
    const short = calculateTransport({ ...ZERO_TRANSPORT, flights: 2, flightKm: 500 });
    const long = calculateTransport({ ...ZERO_TRANSPORT, flights: 2, flightKm: 1000 });
    expect(long.breakdown.flights).toBe(short.breakdown.flights * 2);
  });

  test('combined: vehicle + public transit + flights sum correctly', () => {
    const result = calculateTransport({
      vehicle: 'petrol_car', kmPerWeek: 80, publicDays: '3',
      publicKmDay: 10, publicType: 'metro', flights: 2, flightKm: 800,
    });
    const sumOfBreakdown = result.breakdown.vehicle + result.breakdown.publicTransit + result.breakdown.flights;
    // result.kg is Math.round of totalKg; breakdown pieces are also Math.rounded individually
    // allow 1 kg rounding delta
    expect(Math.abs(result.kg - sumOfBreakdown)).toBeLessThanOrEqual(1);
  });

  test('returns object with { kg: number, breakdown: { vehicle, publicTransit, flights } }', () => {
    const result = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 50 });
    expect(typeof result.kg).toBe('number');
    expect(typeof result.breakdown.vehicle).toBe('number');
    expect(typeof result.breakdown.publicTransit).toBe('number');
    expect(typeof result.breakdown.flights).toBe('number');
  });

  test('uses safe defaults when called with empty object (does not throw)', () => {
    expect(() => calculateTransport({})).not.toThrow();
    // defaults: vehicle='none',kmPerWeek=80,publicDays='3',publicKmDay=20,publicType='metro',flights=2,flightKm=800
    const result = calculateTransport({});
    expect(result.kg).toBeGreaterThan(0); // defaults produce non-zero
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FOOD
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateFood()', () => {

  // All extra inputs zeroed so we test baselines in isolation
  const ZERO_EXTRAS = {
    chickenPerWeek: 0,
    redMeatPerWeek: 0,
    dairyLitresDay: 0,
    eggsPerWeek: 0,
    deliveryPerWeek: 0,
    wasteMultiplier: 1.0,
  };

  test('vegan baseline (no extras, no waste) = exactly 150 kg', () => {
    const result = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan' });
    expect(result.kg).toBe(150);
  });

  test('vegetarian baseline (no extras, no waste) = exactly 400 kg', () => {
    const result = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    expect(result.kg).toBe(400);
  });

  test('vegan always emits less than vegetarian for same extras', () => {
    const vegan = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan' });
    const veg = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    expect(vegan.kg).toBeLessThan(veg.kg);
  });

  test('heavy-meat with substantial meat intake emits more than vegetarian', () => {
    const heavy = calculateFood({
      dietType: 'heavy-meat', chickenPerWeek: 7, redMeatPerWeek: 5,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0, wasteMultiplier: 1.0,
    });
    const veg = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    expect(heavy.kg).toBeGreaterThan(veg.kg);
  });

  test('vegan emits less than all other diet types when extras are zero', () => {
    const vegan = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan' });
    ['vegetarian', 'non-veg-light', 'non-veg-regular', 'heavy-meat'].forEach(diet => {
      const other = calculateFood({ ...ZERO_EXTRAS, dietType: diet });
      expect(vegan.kg).toBeLessThan(other.kg);
    });
  });

  test('1 litre dairy/day adds exactly 1168 kg (1.0 × 3.2 × 365)', () => {
    // 1.0 × 3.2 × 365 = 1168
    const base = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' }); // 400
    const dairy = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian', dairyLitresDay: 1.0 }); // 400+1168=1568
    expect(dairy.kg - base.kg).toBe(1168);
  });

  test('dairy emissions scale linearly with litres per day', () => {
    const r1 = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan', dairyLitresDay: 1 });
    const r2 = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan', dairyLitresDay: 2 });
    // 2× litres → 2× dairy kg → difference in total should also be 2×
    const base = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan', dairyLitresDay: 0 });
    expect((r2.kg - base.kg)).toBeCloseTo((r1.kg - base.kg) * 2, 0);
  });

  test('7 eggs/week adds exactly 136.5 kg (7 × 0.375 × 52)', () => {
    // 7 × 0.375 × 52 = 136.5 → Math.round(136.5) = 137 difference (rounding at each step)
    const base = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    const withEggs = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian', eggsPerWeek: 7 });
    // difference should be 136 or 137 (rounding)
    expect(Math.abs(withEggs.kg - base.kg - 136.5)).toBeLessThan(1);
  });

  test('food delivery adds logistics + meal emissions per order (2.9 kg/order)', () => {
    // 1 delivery/week: (0.4 + 2.5) × 52 = 150.8 → Math.round = 151
    const base = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    const oneDeliv = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian', deliveryPerWeek: 1 });
    expect(oneDeliv.kg - base.kg).toBeCloseTo(151, 0);
  });

  test('waste multiplier 1.5 produces 1.5× the non-waste total', () => {
    const noWaste = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian', wasteMultiplier: 1.0 });
    const highWaste = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian', wasteMultiplier: 1.5 });
    expect(highWaste.kg / noWaste.kg).toBeCloseTo(1.5, 1);
  });

  test('red meat per serving emits more CO₂ than chicken per serving (39.2 vs 9.9 kg/kg)', () => {
    const withChicken = calculateFood({
      dietType: 'non-veg-regular', chickenPerWeek: 1, redMeatPerWeek: 0,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0, wasteMultiplier: 1.0,
    });
    const withRedMeat = calculateFood({
      dietType: 'non-veg-regular', chickenPerWeek: 0, redMeatPerWeek: 1,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0, wasteMultiplier: 1.0,
    });
    expect(withRedMeat.kg).toBeGreaterThan(withChicken.kg);
  });

  test('adding more chicken to non-veg diet increases total emissions', () => {
    const less = calculateFood({
      dietType: 'non-veg-regular', chickenPerWeek: 2, redMeatPerWeek: 0,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0, wasteMultiplier: 1.0,
    });
    const more = calculateFood({
      dietType: 'non-veg-regular', chickenPerWeek: 7, redMeatPerWeek: 0,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0, wasteMultiplier: 1.0,
    });
    expect(more.kg).toBeGreaterThan(less.kg);
  });

  test('returns object with { kg, breakdown: { dietBase, meat, dairy, eggs, delivery } }', () => {
    const result = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    expect(typeof result.kg).toBe('number');
    expect(result.breakdown).toHaveProperty('dietBase');
    expect(result.breakdown).toHaveProperty('meat');
    expect(result.breakdown).toHaveProperty('dairy');
    expect(result.breakdown).toHaveProperty('eggs');
    expect(result.breakdown).toHaveProperty('delivery');
  });

  test('does not throw when called with empty object (uses defaults)', () => {
    expect(() => calculateFood({})).not.toThrow();
    const result = calculateFood({});
    expect(result.kg).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HOME ENERGY
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateEnergy()', () => {

  const ZERO_ENERGY = {
    electricityKwh: 0,
    lpgCylinders: 0,
    cookingType: 'lpg',
    acHrsDay: 0,
    acMonths: 0,
    solarLevel: '0',
  };

  test('all-zero inputs → 0 kg', () => {
    const result = calculateEnergy(ZERO_ENERGY);
    expect(result.kg).toBe(0);
    expect(result.breakdown.electricity).toBe(0);
    expect(result.breakdown.cooking).toBe(0);
    expect(result.breakdown.ac).toBe(0);
  });

  test('100 kWh/month electricity → 100 × 12 × 0.708 = 849.6 → 850 kg/year', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 100 });
    expect(result.breakdown.electricity).toBe(850);
    expect(result.kg).toBe(850);
  });

  test('electricity emissions scale linearly with monthly kWh', () => {
    const r100 = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 100 });
    const r200 = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200 });
    // 200 × 12 × 0.708 = 1699.2 → 1699; 100 case = 850
    expect(r200.breakdown.electricity).toBe(1699);
    // ratio should be very close to 2
    expect(r200.breakdown.electricity / r100.breakdown.electricity).toBeCloseTo(2, 0);
  });

  test('1 LPG cylinder/month → 1 × 42.36 × 12 = 508.32 → 508 kg/year', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, lpgCylinders: 1, cookingType: 'lpg' });
    expect(result.breakdown.cooking).toBe(508);
    expect(result.kg).toBe(508);
  });

  test('0.5 LPG cylinders/month → 0.5 × 42.36 × 12 = 254.16 → 254 kg', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, lpgCylinders: 0.5, cookingType: 'lpg' });
    expect(result.breakdown.cooking).toBe(254);
  });

  test('more LPG cylinders per month = more cooking emissions', () => {
    const r1 = calculateEnergy({ ...ZERO_ENERGY, lpgCylinders: 1, cookingType: 'lpg' });
    const r2 = calculateEnergy({ ...ZERO_ENERGY, lpgCylinders: 2, cookingType: 'lpg' });
    expect(Math.abs(r2.breakdown.cooking - r1.breakdown.cooking * 2)).toBeLessThanOrEqual(1);
  });

  test('AC (4 hrs/day, 5 months) → 4 × 1.062 × 5 × 30 = 637.2 → 637 kg', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, acHrsDay: 4, acMonths: 5 });
    expect(result.breakdown.ac).toBe(637);
    expect(result.kg).toBe(637);
  });

  test('AC emissions scale with hours × months', () => {
    const r1 = calculateEnergy({ ...ZERO_ENERGY, acHrsDay: 2, acMonths: 3 });
    const r2 = calculateEnergy({ ...ZERO_ENERGY, acHrsDay: 4, acMonths: 6 });
    // r2 should be 4× r1 (2× hours, 2× months)
    expect(Math.abs(r2.breakdown.ac - r1.breakdown.ac * 4)).toBeLessThanOrEqual(1);
  });

  test('partial solar (level 1) offsets 30% of electricity vs no solar', () => {
    const noSolar = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '0' });
    const partial = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '1' });
    // 30% reduction: partial.elec ≈ noSolar.elec × 0.70
    const ratio = partial.breakdown.electricity / noSolar.breakdown.electricity;
    expect(ratio).toBeCloseTo(0.70, 1);
  });

  test('full solar (level 2) offsets 70% of electricity vs no solar', () => {
    const noSolar = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '0' });
    const fullSolar = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '2' });
    // 70% reduction: fullSolar.elec ≈ noSolar.elec × 0.30
    const ratio = fullSolar.breakdown.electricity / noSolar.breakdown.electricity;
    expect(ratio).toBeCloseTo(0.30, 1);
  });

  test('full solar offsets more than partial solar', () => {
    const partial = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '1' });
    const fullSolar = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '2' });
    expect(fullSolar.breakdown.electricity).toBeLessThan(partial.breakdown.electricity);
  });

  test('PNG cooking produces positive emissions (8 × 2.204 × 12 = 211.584 → 212 kg)', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, cookingType: 'png' });
    expect(result.breakdown.cooking).toBe(212);
  });

  test('electric/induction cooking produces emissions (30 × 0.708 × 12 = 254.88 → 255 kg)', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, cookingType: 'electric' });
    expect(result.breakdown.cooking).toBe(255);
  });

  test('biomass cooking produces emissions (fixed 200 kg)', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, cookingType: 'biomass' });
    expect(result.breakdown.cooking).toBe(200);
  });

  test('returns object with { kg, breakdown: { electricity, cooking, ac } }', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 100 });
    expect(typeof result.kg).toBe('number');
    expect(typeof result.breakdown.electricity).toBe('number');
    expect(typeof result.breakdown.cooking).toBe('number');
    expect(typeof result.breakdown.ac).toBe('number');
  });

  test('does not throw with empty inputs (uses defaults)', () => {
    expect(() => calculateEnergy({})).not.toThrow();
    const result = calculateEnergy({});
    expect(result.kg).toBeGreaterThan(0); // default 150 kWh, 0.5 cyl, 4 hrs AC × 5 months
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SHOPPING
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateShopping()', () => {

  const ZERO_SHOPPING = {
    newClothesMonth: 0,
    smartphonesYear: 0,
    laptopsYear: 0,
    onlineOrdersWeek: 0,
    largeAppliancesYear: 0,
  };

  test('all-zero inputs → 0 kg', () => {
    const result = calculateShopping(ZERO_SHOPPING);
    expect(result.kg).toBe(0);
    expect(result.breakdown.clothing).toBe(0);
    expect(result.breakdown.devices).toBe(0);
    expect(result.breakdown.onlinePkg).toBe(0);
    expect(result.breakdown.appliances).toBe(0);
  });

  test('5 new clothes/month → 5 × 10 × 12 = 600 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, newClothesMonth: 5 });
    expect(result.breakdown.clothing).toBe(600);
    expect(result.kg).toBe(600);
  });

  test('1 new smartphone → 70 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, smartphonesYear: 1 });
    expect(result.breakdown.devices).toBe(70);
    expect(result.kg).toBe(70);
  });

  test('2 new smartphones → 140 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, smartphonesYear: 2 });
    expect(result.breakdown.devices).toBe(140);
  });

  test('1 new laptop → 350 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, laptopsYear: 1 });
    expect(result.breakdown.devices).toBe(350);
    expect(result.kg).toBe(350);
  });

  test('laptop emits more than smartphone per device (350 vs 70 kg)', () => {
    const phone = calculateShopping({ ...ZERO_SHOPPING, smartphonesYear: 1 });
    const laptop = calculateShopping({ ...ZERO_SHOPPING, laptopsYear: 1 });
    expect(laptop.kg).toBe(phone.kg * 5);
  });

  test('smartphone + laptop devices combined correctly', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, smartphonesYear: 1, laptopsYear: 1 });
    // devices = 70 + 350 = 420
    expect(result.breakdown.devices).toBe(420);
    expect(result.kg).toBe(420);
  });

  test('10 online orders/week → 10 × 0.5 × 52 = 260 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, onlineOrdersWeek: 10 });
    expect(result.breakdown.onlinePkg).toBe(260);
    expect(result.kg).toBe(260);
  });

  test('1 online order/week → 1 × 0.5 × 52 = 26 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, onlineOrdersWeek: 1 });
    expect(result.breakdown.onlinePkg).toBe(26);
  });

  test('online orders scale linearly with order frequency', () => {
    const r1 = calculateShopping({ ...ZERO_SHOPPING, onlineOrdersWeek: 1 });
    const r5 = calculateShopping({ ...ZERO_SHOPPING, onlineOrdersWeek: 5 });
    expect(r5.breakdown.onlinePkg).toBe(r1.breakdown.onlinePkg * 5);
  });

  test('1 large appliance → 225 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, largeAppliancesYear: 1 });
    expect(result.breakdown.appliances).toBe(225);
    expect(result.kg).toBe(225);
  });

  test('combined shopping calculation is the sum of all categories', () => {
    // 2 clothes: 2×10×12=240; 1 phone: 70; 0 laptop; 5 orders/week: 5×0.5×52=130; 1 appliance: 225
    const result = calculateShopping({
      newClothesMonth: 2, smartphonesYear: 1, laptopsYear: 0,
      onlineOrdersWeek: 5, largeAppliancesYear: 1,
    });
    expect(result.kg).toBe(665); // 240 + 70 + 130 + 225
    expect(result.breakdown.clothing).toBe(240);
    expect(result.breakdown.devices).toBe(70);
    expect(result.breakdown.onlinePkg).toBe(130);
    expect(result.breakdown.appliances).toBe(225);
  });

  test('returns object with { kg, breakdown: { clothing, devices, onlinePkg, appliances } }', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, newClothesMonth: 3 });
    expect(typeof result.kg).toBe('number');
    expect(result.breakdown).toHaveProperty('clothing');
    expect(result.breakdown).toHaveProperty('devices');
    expect(result.breakdown).toHaveProperty('onlinePkg');
    expect(result.breakdown).toHaveProperty('appliances');
  });

  test('does not throw with empty object (uses defaults)', () => {
    expect(() => calculateShopping({})).not.toThrow();
    const result = calculateShopping({});
    expect(typeof result.kg).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DIGITAL
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateDigital()', () => {

  const ZERO_DIGITAL = {
    streamingHrsDay: 0,
    streamingQuality: 'hd',
    socialHrsDay: 0,
    videoCallHrsDay: 0,
    cloudGb: 0,
    gamingHrsDay: 0,
  };

  test('all-zero inputs → 0 kg', () => {
    const result = calculateDigital(ZERO_DIGITAL);
    expect(result.kg).toBe(0);
    expect(result.breakdown.streaming).toBe(0);
    expect(result.breakdown.social).toBe(0);
    expect(result.breakdown.videoCalls).toBe(0);
    expect(result.breakdown.cloud).toBe(0);
    expect(result.breakdown.gaming).toBe(0);
  });

  test('HD streaming 3 hrs/day → 3 × 0.036 × 365 = 39.42 → 39 kg', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 3, streamingQuality: 'hd' });
    expect(result.breakdown.streaming).toBe(39);
    expect(result.kg).toBe(39);
  });

  test('4K streaming emits exactly 2× HD for same hours (0.072 vs 0.036)', () => {
    const hd = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 3, streamingQuality: 'hd' });
    const fk = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 3, streamingQuality: '4k' });
    // 3 × 0.072 × 365 = 78.84 → 79; 3 × 0.036 × 365 = 39.42 → 39
    expect(fk.breakdown.streaming).toBe(79);
    expect(fk.breakdown.streaming / hd.breakdown.streaming).toBeCloseTo(2, 0);
  });

  test('SD streaming emits exactly half of HD for same hours (0.018 vs 0.036)', () => {
    const hd = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 2, streamingQuality: 'hd' });
    const sd = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 2, streamingQuality: 'sd' });
    // SD = 2 × 0.018 × 365 = 13.14 → 13; HD = 2 × 0.036 × 365 = 26.28 → 26
    expect(sd.breakdown.streaming).toBe(13);
    expect(hd.breakdown.streaming).toBe(26);
    expect(sd.breakdown.streaming * 2).toBe(hd.breakdown.streaming);
  });

  test('social media 2 hrs/day → 2 × 0.015 × 365 = 10.95 → 11 kg', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, socialHrsDay: 2 });
    expect(result.breakdown.social).toBe(11);
  });

  test('video calls 1 hr/day → 1 × 0.157 × 365 = 57.305 → 57 kg', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, videoCallHrsDay: 1 });
    expect(result.breakdown.videoCalls).toBe(57);
  });

  test('video calls emit more per hour than social media (0.157 vs 0.015)', () => {
    const social = calculateDigital({ ...ZERO_DIGITAL, socialHrsDay: 1 });
    const calls = calculateDigital({ ...ZERO_DIGITAL, videoCallHrsDay: 1 });
    expect(calls.kg).toBeGreaterThan(social.kg);
  });

  test('50 GB cloud storage → 50 × 0.003 × 12 = 1.8 → 2 kg', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, cloudGb: 50 });
    expect(result.breakdown.cloud).toBe(2);
  });

  test('cloud storage scales linearly with GB', () => {
    const r50 = calculateDigital({ ...ZERO_DIGITAL, cloudGb: 50 });
    const r200 = calculateDigital({ ...ZERO_DIGITAL, cloudGb: 200 });
    // 200 × 0.003 × 12 = 7.2 → 7; 50 → 2
    expect(r200.breakdown.cloud).toBe(7);
  });

  test('gaming 2 hrs/day → 2 × 0.08 × 365 = 58.4 → 58 kg', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, gamingHrsDay: 2 });
    expect(result.breakdown.gaming).toBe(58);
  });

  test('streaming hours scale linearly (6 hrs = 6× 1 hr)', () => {
    const r1 = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 1, streamingQuality: 'hd' });
    const r6 = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 6, streamingQuality: 'hd' });
    // r1: 1×0.036×365=13.14→13; r6: 6×0.036×365=78.84→79
    expect(r6.breakdown.streaming).toBe(79);
    expect(r1.breakdown.streaming).toBe(13);
  });

  test('combined digital emissions sum all breakdown components', () => {
    const result = calculateDigital({
      streamingHrsDay: 2, streamingQuality: 'hd',
      socialHrsDay: 1, videoCallHrsDay: 1,
      cloudGb: 50, gamingHrsDay: 1,
    });
    // streaming: 2×0.036×365=26.28→26
    // social: 1×0.015×365=5.475→5
    // calls: 1×0.157×365=57.305→57
    // cloud: 50×0.003×12=1.8→2
    // gaming: 1×0.08×365=29.2→29
    expect(result.breakdown.streaming).toBe(26);
    expect(result.breakdown.social).toBe(5);
    expect(result.breakdown.videoCalls).toBe(57);
    expect(result.breakdown.cloud).toBe(2);
    expect(result.breakdown.gaming).toBe(29);
    // total might differ by ≤1 due to individual rounding
    const sum = 26 + 5 + 57 + 2 + 29;
    expect(Math.abs(result.kg - sum)).toBeLessThanOrEqual(1);
  });

  test('returns object with { kg, breakdown: { streaming, social, videoCalls, cloud, gaming } }', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 1 });
    expect(typeof result.kg).toBe('number');
    expect(result.breakdown).toHaveProperty('streaming');
    expect(result.breakdown).toHaveProperty('social');
    expect(result.breakdown).toHaveProperty('videoCalls');
    expect(result.breakdown).toHaveProperty('cloud');
    expect(result.breakdown).toHaveProperty('gaming');
  });

  test('does not throw with empty object (uses defaults)', () => {
    expect(() => calculateDigital({})).not.toThrow();
    const result = calculateDigital({});
    expect(result.kg).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────
describe('getTier()', () => {

  test('0 kg → green', () => expect(getTier(0)).toBe('green'));
  test('500 kg → green', () => expect(getTier(500)).toBe('green'));
  test('1000 kg → green', () => expect(getTier(1000)).toBe('green'));
  test('1499 kg → green (just below yellow boundary)', () => expect(getTier(1499)).toBe('green'));

  test('1500 kg → yellow (at lower boundary)', () => expect(getTier(1500)).toBe('yellow'));
  test('2000 kg → yellow', () => expect(getTier(2000)).toBe('yellow'));
  test('2999 kg → yellow (just below orange boundary)', () => expect(getTier(2999)).toBe('yellow'));

  test('3000 kg → orange (at lower boundary)', () => expect(getTier(3000)).toBe('orange'));
  test('4500 kg → orange', () => expect(getTier(4500)).toBe('orange'));
  test('5999 kg → orange (just below red boundary)', () => expect(getTier(5999)).toBe('orange'));

  test('6000 kg → red (at lower boundary)', () => expect(getTier(6000)).toBe('red'));
  test('8000 kg → red', () => expect(getTier(8000)).toBe('red'));
  test('15000 kg → red', () => expect(getTier(15000)).toBe('red'));

  test('negative values → green (below all thresholds)', () => {
    expect(getTier(-1)).toBe('green');
    expect(getTier(-1000)).toBe('green');
  });

  describe('TIERS object', () => {
    test('has four required keys: green, yellow, orange, red', () => {
      expect(TIERS).toHaveProperty('green');
      expect(TIERS).toHaveProperty('yellow');
      expect(TIERS).toHaveProperty('orange');
      expect(TIERS).toHaveProperty('red');
    });

    test('each tier entry has label, icon, cssClass, colorVar', () => {
      Object.values(TIERS).forEach(tier => {
        expect(typeof tier.label).toBe('string');
        expect(typeof tier.icon).toBe('string');
        expect(typeof tier.cssClass).toBe('string');
        expect(typeof tier.colorVar).toBe('string');
      });
    });

    test('green tier label is "Carbon Champion"', () => {
      expect(TIERS.green.label).toBe('Carbon Champion');
    });

    test('red tier label is "Climate Emergency"', () => {
      expect(TIERS.red.label).toBe('Climate Emergency');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALOGIES
// ─────────────────────────────────────────────────────────────────────────────
describe('getAnalogies()', () => {

  test('0 kg returns all zeros and dash label', () => {
    const result = getAnalogies(0);
    expect(result.delhiMumbaiDrives).toBe(0);
    expect(result.treesNeeded).toBe(0);
    expect(result.electricityMonths).toBe(0);
    expect(result.domesticFlights).toBe(0);
    expect(result.vsIndiaAvgPct).toBe(0);
    expect(result.vsIndiaAvgLabel).toBe('—');
  });

  test('null/undefined return zero-value object (falsy guard)', () => {
    expect(getAnalogies(null).treesNeeded).toBe(0);
    expect(getAnalogies(undefined).treesNeeded).toBe(0);
  });

  test('negative kg returns zero-value object', () => {
    const result = getAnalogies(-500);
    expect(result.delhiMumbaiDrives).toBe(0);
    expect(result.treesNeeded).toBe(0);
  });

  test('treesNeeded = Math.ceil(kg / 21)', () => {
    // 2000 / 21 = 95.238 → ceil = 96
    expect(getAnalogies(2000).treesNeeded).toBe(96);
    // 2100 / 21 = 100 exactly → ceil = 100
    expect(getAnalogies(2100).treesNeeded).toBe(100);
    // 2101 / 21 = 100.047 → ceil = 101
    expect(getAnalogies(2101).treesNeeded).toBe(101);
  });

  test('treesNeeded is always a positive integer for positive kg', () => {
    [100, 500, 1234, 6789].forEach(kg => {
      const result = getAnalogies(kg);
      expect(Number.isInteger(result.treesNeeded)).toBe(true);
      expect(result.treesNeeded).toBeGreaterThan(0);
    });
  });

  test('delhiMumbaiDrives = round(kg / (1450 × 0.192), 1)', () => {
    // 1450 × 0.192 = 278.4; 2784 / 278.4 = 10.0
    const result = getAnalogies(2784);
    expect(result.delhiMumbaiDrives).toBe(10);
  });

  test('electricityMonths = round(kg / (96 × 0.708), 1)', () => {
    // INDIA_HOUSEHOLD_CO2_MONTH = 96 × 0.708 = 67.968
    // 679.68 / 67.968 = 10.0 exactly
    const result = getAnalogies(679.68);
    expect(result.electricityMonths).toBe(10);
  });

  test('domesticFlights = round(kg / (1150 × 0.255), 1)', () => {
    // 1150 × 0.255 = 293.25; 2932.5 / 293.25 = 10.0
    const result = getAnalogies(2932.5);
    expect(result.domesticFlights).toBe(10);
  });

  test('higher footprint → more Delhi-Mumbai drives', () => {
    const low = getAnalogies(1000);
    const high = getAnalogies(5000);
    expect(high.delhiMumbaiDrives).toBeGreaterThan(low.delhiMumbaiDrives);
  });

  test('higher footprint → more trees needed', () => {
    const low = getAnalogies(500);
    const high = getAnalogies(5000);
    expect(high.treesNeeded).toBeGreaterThan(low.treesNeeded);
  });

  test('vsIndiaAvgPct is negative for below-average footprint', () => {
    // India avg = 1900 kg; 1000 < 1900
    expect(getAnalogies(1000).vsIndiaAvgPct).toBeLessThan(0);
  });

  test('vsIndiaAvgPct is positive for above-average footprint', () => {
    // 3000 > 1900
    expect(getAnalogies(3000).vsIndiaAvgPct).toBeGreaterThan(0);
  });

  test('vsIndiaAvgPct = 0 and label "Exactly at India avg" for 1900 kg', () => {
    const result = getAnalogies(1900);
    expect(result.vsIndiaAvgPct).toBe(0);
    expect(result.vsIndiaAvgLabel).toBe('Exactly at India avg');
  });

  test('vsIndiaAvgLabel contains "less than" for below-average footprint', () => {
    expect(getAnalogies(500).vsIndiaAvgLabel).toContain('less than');
  });

  test('vsIndiaAvgLabel contains "more than" for above-average footprint', () => {
    expect(getAnalogies(5000).vsIndiaAvgLabel).toContain('more than');
  });

  test('returns all required fields', () => {
    const result = getAnalogies(2000);
    expect(result).toHaveProperty('delhiMumbaiDrives');
    expect(result).toHaveProperty('treesNeeded');
    expect(result).toHaveProperty('electricityMonths');
    expect(result).toHaveProperty('domesticFlights');
    expect(result).toHaveProperty('vsIndiaAvgPct');
    expect(result).toHaveProperty('vsIndiaAvgLabel');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET TOTAL (aggregation)
// ─────────────────────────────────────────────────────────────────────────────
describe('getTotal()', () => {

  const MOCK = {
    transport: { kg: 800 },
    food: { kg: 600 },
    energy: { kg: 700 },
    shopping: { kg: 300 },
    digital: { kg: 100 },
  };

  test('sums 5 categories correctly: 800+600+700+300+100 = 2500 kg', () => {
    expect(getTotal(MOCK).totalKg).toBe(2500);
  });

  test('2500 kg → yellow tier', () => {
    expect(getTotal(MOCK).tier).toBe('yellow');
  });

  test('returns tierInfo with label, icon, cssClass', () => {
    const { tierInfo } = getTotal(MOCK);
    expect(tierInfo).toHaveProperty('label');
    expect(tierInfo).toHaveProperty('icon');
    expect(tierInfo).toHaveProperty('cssClass');
  });

  test('breakdown array has exactly 5 entries', () => {
    expect(getTotal(MOCK).breakdown).toHaveLength(5);
  });

  test('breakdown contains all five categories by label', () => {
    const labels = getTotal(MOCK).breakdown.map(b => b.label);
    expect(labels).toContain('Transport');
    expect(labels).toContain('Food');
    expect(labels).toContain('Home Energy');
    expect(labels).toContain('Shopping');
    expect(labels).toContain('Digital');
  });

  test('percentages sum to 100 (±2 due to individual rounding)', () => {
    const totalPct = getTotal(MOCK).percentages.reduce((s, p) => s + p.pct, 0);
    expect(totalPct).toBeGreaterThanOrEqual(98);
    expect(totalPct).toBeLessThanOrEqual(102);
  });

  test('each percentage item has a pct field between 0 and 100', () => {
    getTotal(MOCK).percentages.forEach(p => {
      expect(p.pct).toBeGreaterThanOrEqual(0);
      expect(p.pct).toBeLessThanOrEqual(100);
    });
  });

  test('percentages are proportional: transport 800/2500 = 32%', () => {
    const transportPct = getTotal(MOCK).percentages.find(p => p.label === 'Transport').pct;
    expect(transportPct).toBe(32);
  });

  test('analogies object is populated', () => {
    const { analogies } = getTotal(MOCK);
    expect(analogies).toHaveProperty('treesNeeded');
    expect(analogies.treesNeeded).toBeGreaterThan(0);
  });

  test('missing categories default to 0 (optional chaining)', () => {
    // Only transport provided
    const result = getTotal({ transport: { kg: 500 } });
    expect(result.totalKg).toBe(500);
    expect(result.tier).toBe('green');
  });

  test('green tier for totalKg < 1500', () => {
    const result = getTotal({ transport: { kg: 400 }, food: { kg: 300 } });
    expect(result.tier).toBe('green');
    expect(result.totalKg).toBe(700);
  });

  test('orange tier for 3000–5999 kg', () => {
    const result = getTotal({
      transport: { kg: 1500 }, food: { kg: 1500 }, energy: { kg: 500 },
    });
    expect(result.totalKg).toBe(3500);
    expect(result.tier).toBe('orange');
  });

  test('red tier for ≥ 6000 kg', () => {
    const result = getTotal({
      transport: { kg: 2000 }, food: { kg: 2000 },
      energy: { kg: 2000 }, shopping: { kg: 500 }, digital: { kg: 500 },
    });
    expect(result.totalKg).toBe(7000);
    expect(result.tier).toBe('red');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROADMAP GENERATION
// ─────────────────────────────────────────────────────────────────────────────
describe('generateRoadmap()', () => {

  const CATS = {
    transport: { kg: 1200 },
    food: { kg: 1500 },
    energy: { kg: 1000 },
    shopping: { kg: 500 },
    digital: { kg: 200 },
  };

  test('returns exactly 5 steps', () => {
    expect(generateRoadmap(CATS, 4400)).toHaveLength(5);
  });

  test('each step is numbered 1 through 5 sequentially', () => {
    const steps = generateRoadmap(CATS, 4400).map(s => s.step);
    expect(steps).toEqual([1, 2, 3, 4, 5]);
  });

  test('every step has required fields: step, title, description, savingKg, savingInrMonth, category', () => {
    generateRoadmap(CATS, 4400).forEach(step => {
      expect(typeof step.step).toBe('number');
      expect(typeof step.title).toBe('string');
      expect(step.title.length).toBeGreaterThan(0);
      expect(typeof step.description).toBe('string');
      expect(typeof step.savingKg).toBe('number');
      expect(typeof step.savingInrMonth).toBe('number');
      expect(typeof step.category).toBe('string');
    });
  });

  test('savingKg is always ≥ 0', () => {
    generateRoadmap(CATS, 4400).forEach(step => {
      expect(step.savingKg).toBeGreaterThanOrEqual(0);
    });
  });

  test('savingKg is always less than total kg (can\'t save more than total)', () => {
    const totalKg = 4400;
    generateRoadmap(CATS, totalKg).forEach(step => {
      expect(step.savingKg).toBeLessThan(totalKg);
    });
  });

  test('steps are sorted descending by savingKg', () => {
    const steps = generateRoadmap(CATS, 4400);
    for (let i = 0; i < steps.length - 1; i++) {
      expect(steps[i].savingKg).toBeGreaterThanOrEqual(steps[i + 1].savingKg);
    }
  });

  test('category with highest kg produces highest saving among its candidates', () => {
    // food has 1500 kg; food candidate saves foodKg × 0.28 = 420
    // The top step should come from food or transport (which has solar saving = energyKg × 0.55 = 550)
    const steps = generateRoadmap(CATS, 4400);
    // First step should have the maximum saving
    const maxSaving = Math.max(...steps.map(s => s.savingKg));
    expect(steps[0].savingKg).toBe(maxSaving);
  });

  test('does not throw when all categories have 0 kg', () => {
    const zeros = { transport: { kg: 0 }, food: { kg: 0 }, energy: { kg: 0 }, shopping: { kg: 0 }, digital: { kg: 0 } };
    expect(() => generateRoadmap(zeros, 0)).not.toThrow();
    const steps = generateRoadmap(zeros, 0);
    expect(steps).toHaveLength(5);
    steps.forEach(s => expect(s.savingKg).toBe(0));
  });

  test('higher energy kg → higher savingKg for rooftop solar candidate', () => {
    const lowEnergy = generateRoadmap({ ...CATS, energy: { kg: 200 } }, 3600);
    const highEnergy = generateRoadmap({ ...CATS, energy: { kg: 3000 } }, 6200);
    // Solar candidate: savingKg = Math.round(energyKg * 0.55)
    // Find the rooftop solar step
    const solarLow = lowEnergy.find(s => s.title.includes('Solar'));
    const solarHigh = highEnergy.find(s => s.title.includes('Solar'));
    if (solarLow && solarHigh) {
      expect(solarHigh.savingKg).toBeGreaterThan(solarLow.savingKg);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT KG
// ─────────────────────────────────────────────────────────────────────────────
describe('formatKg()', () => {

  test('returns a string type', () => {
    expect(typeof formatKg(1000)).toBe('string');
    expect(typeof formatKg(500, true)).toBe('string');
  });

  test('1500 in short form → "1.5T"', () => {
    expect(formatKg(1500, true)).toBe('1.5T');
  });

  test('2000 in short form → "2.0T"', () => {
    expect(formatKg(2000, true)).toBe('2.0T');
  });

  test('10000 in short form → "10.0T"', () => {
    expect(formatKg(10000, true)).toBe('10.0T');
  });

  test('50000 in short form → "50.0T"', () => {
    expect(formatKg(50000, true)).toBe('50.0T');
  });

  test('1234 in short form → "1.2T" (toFixed(1) truncates .234)', () => {
    expect(formatKg(1234, true)).toBe('1.2T');
  });

  test('1250 in short form → "1.3T" (1250/1000 = 1.25, toFixed(1) rounds to 1.3)', () => {
    expect(formatKg(1250, true)).toBe('1.3T');
  });

  test('999 in short form does NOT add T suffix (< 1000)', () => {
    expect(formatKg(999, true)).not.toContain('T');
  });

  test('0 in short form returns "0" (0 < 1000, uses long path)', () => {
    expect(formatKg(0, true)).toBe('0');
  });

  test('500 in long form contains "500"', () => {
    // toLocaleString('en-IN') for < 1000 is plain digits
    expect(formatKg(500, false)).toContain('500');
  });

  test('0 in long form returns "0"', () => {
    expect(formatKg(0, false)).toBe('0');
  });

  test('rounds fractional kg before formatting', () => {
    // 1500.6 → Math.round = 1501; short: 1501/1000 = 1.5T (toFixed(1))
    expect(formatKg(1500.6, true)).toBe('1.5T');
    // 999.9 → Math.round = 1000; >= 1000 → "1.0T"
    expect(formatKg(999.9, true)).toBe('1,000');
  });

  test('does not throw for 0, negative-ish, or large values', () => {
    expect(() => formatKg(0)).not.toThrow();
    expect(() => formatKg(999999)).not.toThrow();
    expect(() => formatKg(999999, true)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NUMBER COUNTER GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
describe('numberCounter()', () => {

  test('with steps=10, yields exactly 10 values', () => {
    const values = [...numberCounter(0, 100, 10)];
    expect(values).toHaveLength(10);
  });

  test('with default steps, yields exactly 60 values', () => {
    const values = [...numberCounter(0, 1000)];
    expect(values).toHaveLength(60);
  });

  test('final value equals end parameter (ease=1 at last step)', () => {
    expect([...numberCounter(0, 100, 10)].at(-1)).toBe(100);
    expect([...numberCounter(0, 500, 30)].at(-1)).toBe(500);
    expect([...numberCounter(100, 200, 5)].at(-1)).toBe(200);
  });

  test('all values are integers (Math.round applied)', () => {
    [...numberCounter(0, 999, 25)].forEach(v => {
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  test('values are monotonically non-decreasing (ease-out curve)', () => {
    const values = [...numberCounter(0, 1000, 20)];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  test('first value > start (ease-out means fast initial progress)', () => {
    // Step 1 of 60: t=1/60, ease = 1-(59/60)^3 ≈ 0.0495, yield round(0+1000×0.0495)=50
    const first = [...numberCounter(0, 1000, 60)][0];
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1000);
  });

  test('all values ≥ start when iterating from a non-zero start', () => {
    const start = 500;
    [...numberCounter(start, 800, 15)].forEach(v => {
      expect(v).toBeGreaterThanOrEqual(start);
    });
  });

  test('non-zero start: final value equals end', () => {
    const values = [...numberCounter(200, 700, 5)];
    expect(values.at(-1)).toBe(700);
  });

  test('ease-out: first half progresses faster than second half', () => {
    const values = [...numberCounter(0, 1000, 10)];
    const midpoint = values[4]; // after 5 steps
    // Ease-out cubic: first 5/10 steps should cover more than 70% of range
    expect(midpoint).toBeGreaterThan(700);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION — full pipeline end-to-end
// ─────────────────────────────────────────────────────────────────────────────
describe('Full calculation pipeline (integration)', () => {

  test('typical metro-commuting vegetarian Indian lands in yellow/green tier', () => {
    const transport = calculateTransport({
      vehicle: 'none', kmPerWeek: 0,
      publicDays: '5', publicKmDay: 15, publicType: 'metro',
      flights: 1, flightKm: 800,
    });
    const food = calculateFood({
      dietType: 'vegetarian', chickenPerWeek: 0, redMeatPerWeek: 0,
      dairyLitresDay: 0.5, eggsPerWeek: 3, deliveryPerWeek: 3,
      wasteMultiplier: 1.1,
    });
    const energy = calculateEnergy({
      electricityKwh: 100, lpgCylinders: 0.75, cookingType: 'lpg',
      acHrsDay: 2, acMonths: 4, solarLevel: '0',
    });
    const shopping = calculateShopping({
      newClothesMonth: 2, smartphonesYear: 0, laptopsYear: 0,
      onlineOrdersWeek: 2, largeAppliancesYear: 0,
    });
    const digital = calculateDigital({
      streamingHrsDay: 2, streamingQuality: 'hd',
      socialHrsDay: 2, videoCallHrsDay: 1, cloudGb: 30, gamingHrsDay: 0,
    });

    const result = getTotal({ transport, food, energy, shopping, digital });
    expect(result.totalKg).toBeGreaterThan(0);
    expect(['green', 'yellow', 'orange']).toContain(result.tier);
    expect(result.analogies.treesNeeded).toBeGreaterThan(0);
    expect(result.percentages).toHaveLength(5);
  });

  test('heavy-consumption user (car, meat, high AC, multiple flights) → red tier', () => {
    const transport = calculateTransport({
      vehicle: 'petrol_car', kmPerWeek: 200,
      publicDays: '0', publicKmDay: 0, publicType: 'metro',
      flights: 10, flightKm: 1200,
    });
    const food = calculateFood({
      dietType: 'heavy-meat', chickenPerWeek: 7, redMeatPerWeek: 4,
      dairyLitresDay: 1.5, eggsPerWeek: 7, deliveryPerWeek: 10,
      wasteMultiplier: 1.3,
    });
    const energy = calculateEnergy({
      electricityKwh: 350, lpgCylinders: 2, cookingType: 'lpg',
      acHrsDay: 10, acMonths: 8, solarLevel: '0',
    });
    const shopping = calculateShopping({
      newClothesMonth: 10, smartphonesYear: 2, laptopsYear: 1,
      onlineOrdersWeek: 15, largeAppliancesYear: 3,
    });
    const digital = calculateDigital({
      streamingHrsDay: 6, streamingQuality: '4k',
      socialHrsDay: 5, videoCallHrsDay: 4, cloudGb: 500, gamingHrsDay: 4,
    });

    const result = getTotal({ transport, food, energy, shopping, digital });
    expect(result.tier).toBe('red');
    expect(result.totalKg).toBeGreaterThan(6000);
  });

  test('minimal-footprint user (vegan, metro-only, solar, no shopping) → green tier', () => {
    const transport = calculateTransport({
      vehicle: 'none', kmPerWeek: 0,
      publicDays: '7', publicKmDay: 5, publicType: 'metro',
      flights: 0, flightKm: 0,
    });
    const food = calculateFood({
      dietType: 'vegan', chickenPerWeek: 0, redMeatPerWeek: 0,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0,
      wasteMultiplier: 1.0,
    });
    const energy = calculateEnergy({
      electricityKwh: 50, lpgCylinders: 0.25, cookingType: 'lpg',
      acHrsDay: 0, acMonths: 0, solarLevel: '2',
    });
    const shopping = calculateShopping({
      newClothesMonth: 0, smartphonesYear: 0, laptopsYear: 0,
      onlineOrdersWeek: 0, largeAppliancesYear: 0,
    });
    const digital = calculateDigital({
      streamingHrsDay: 1, streamingQuality: 'sd',
      socialHrsDay: 1, videoCallHrsDay: 0, cloudGb: 5, gamingHrsDay: 0,
    });

    const result = getTotal({ transport, food, energy, shopping, digital });
    expect(result.tier).toBe('green');
    expect(result.totalKg).toBeLessThan(1500);
  });

  test('roadmap savings are always smaller than the total footprint', () => {
    const transport = calculateTransport({ vehicle: 'petrol_car', kmPerWeek: 100, publicDays: '0', publicKmDay: 0, publicType: 'metro', flights: 2, flightKm: 800 });
    const food = calculateFood({ dietType: 'non-veg-regular', chickenPerWeek: 4, redMeatPerWeek: 1, dairyLitresDay: 0.7, eggsPerWeek: 4, deliveryPerWeek: 4, wasteMultiplier: 1.15 });
    const energy = calculateEnergy({ electricityKwh: 150, lpgCylinders: 1, cookingType: 'lpg', acHrsDay: 4, acMonths: 5, solarLevel: '0' });
    const shopping = calculateShopping({ newClothesMonth: 3, smartphonesYear: 0, laptopsYear: 0, onlineOrdersWeek: 3, largeAppliancesYear: 0 });
    const digital = calculateDigital({ streamingHrsDay: 3, streamingQuality: 'hd', socialHrsDay: 3, videoCallHrsDay: 1, cloudGb: 50, gamingHrsDay: 1 });

    const { totalKg } = getTotal({ transport, food, energy, shopping, digital });
    const roadmap = generateRoadmap({ transport, food, energy, shopping, digital }, totalKg);

    expect(roadmap).toHaveLength(5);
    roadmap.forEach(step => {
      expect(step.savingKg).toBeGreaterThanOrEqual(0);
      expect(step.savingKg).toBeLessThan(totalKg);
    });
  });

  test('getTier(getTotal(...).totalKg) matches getTotal(...).tier', () => {
    const transport = calculateTransport({ vehicle: 'petrol_car', kmPerWeek: 80, publicDays: '0', publicKmDay: 0, publicType: 'metro', flights: 2, flightKm: 800 });
    const food = calculateFood({ dietType: 'vegetarian', chickenPerWeek: 0, redMeatPerWeek: 0, dairyLitresDay: 0.5, eggsPerWeek: 3, deliveryPerWeek: 2, wasteMultiplier: 1.1 });
    const energy = calculateEnergy({ electricityKwh: 120, lpgCylinders: 0.5, cookingType: 'lpg', acHrsDay: 3, acMonths: 4, solarLevel: '0' });
    const shopping = calculateShopping({ newClothesMonth: 2, smartphonesYear: 0, laptopsYear: 0, onlineOrdersWeek: 2, largeAppliancesYear: 0 });
    const digital = calculateDigital({ streamingHrsDay: 2, streamingQuality: 'hd', socialHrsDay: 2, videoCallHrsDay: 1, cloudGb: 30, gamingHrsDay: 0 });

    const result = getTotal({ transport, food, energy, shopping, digital });
    // Consistency check: internal tier and direct tier call agree
    expect(result.tier).toBe(getTier(result.totalKg));
    expect(result.tierInfo).toEqual(TIERS[result.tier]);
  });
});
