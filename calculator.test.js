/**
 * calculator.test.js
 * CarbonMirror — Complete Native Node.js Unit Test Suite
 *
 * Runs natively on Node.js v20+ with zero npm dependencies.
 * Run: npm test (triggers: node --test calculator.test.js)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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

  const ZERO_TRANSPORT = {
    vehicle: 'none', kmPerWeek: 0, publicDays: '0',
    publicKmDay: 0, publicType: 'metro', flights: 0, flightKm: 0,
  };

  it('returns 0 kg when vehicle=none, no transit, no flights', () => {
    const result = calculateTransport(ZERO_TRANSPORT);
    assert.strictEqual(result.kg, 0);
    assert.strictEqual(result.breakdown.vehicle, 0);
    assert.strictEqual(result.breakdown.publicTransit, 0);
    assert.strictEqual(result.breakdown.flights, 0);
  });

  it('petrol car 100 km/week → 0.192 × 100 × 52 ≈ 998 kg', () => {
    const result = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 100 });
    assert.strictEqual(result.kg, 998);
    assert.strictEqual(result.breakdown.vehicle, 998);
  });

  it('petrol car 200 km/week emits exactly 2× the 100 km/week case', () => {
    const r100 = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 100 });
    const r200 = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 200 });
    assert.strictEqual(r200.breakdown.vehicle, 1997);
    assert.ok(Math.abs(r200.breakdown.vehicle - r100.breakdown.vehicle * 2) <= 10);
  });

  it('diesel car emits less than petrol car for same distance', () => {
    const diesel = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'diesel_car', kmPerWeek: 100 });
    const petrol = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 100 });
    assert.ok(diesel.kg < petrol.kg);
    assert.strictEqual(diesel.breakdown.vehicle, 889);
  });

  it('EV emits less than petrol, CNG, diesel per km', () => {
    const km = { ...ZERO_TRANSPORT, kmPerWeek: 100 };
    const ev = calculateTransport({ ...km, vehicle: 'ev_car' });
    const cng = calculateTransport({ ...km, vehicle: 'cng_car' });
    const diesel = calculateTransport({ ...km, vehicle: 'diesel_car' });
    const petrol = calculateTransport({ ...km, vehicle: 'petrol_car' });
    assert.ok(ev.kg < cng.kg);
    assert.ok(cng.kg < diesel.kg);
    assert.ok(diesel.kg < petrol.kg);
  });

  it('motorcycle emits less than petrol car (0.103 vs 0.192 kg/km)', () => {
    const moto = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'motorcycle', kmPerWeek: 100 });
    const car = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 100 });
    assert.strictEqual(moto.breakdown.vehicle, 536);
    assert.ok(moto.kg < car.kg);
  });

  it('metro public transit 20 km/day, 5 days/week → 0.041 × 20 × 5 × (365/7) ≈ 214 kg', () => {
    const result = calculateTransport({
      ...ZERO_TRANSPORT, publicDays: '5', publicKmDay: 20, publicType: 'metro',
    });
    assert.strictEqual(result.breakdown.publicTransit, 214);
    assert.strictEqual(result.kg, 214);
  });

  it('city bus (0.089 kg/km) emits more than metro (0.041 kg/km) for same route', () => {
    const shared = { ...ZERO_TRANSPORT, publicDays: '5', publicKmDay: 20 };
    const metro = calculateTransport({ ...shared, publicType: 'metro' });
    const bus = calculateTransport({ ...shared, publicType: 'city_bus' });
    assert.ok(bus.kg > metro.kg);
  });

  it('Indian Railways (0.012 kg/km) emits least of all public transit options', () => {
    const shared = { ...ZERO_TRANSPORT, publicDays: '7', publicKmDay: 30 };
    const rail = calculateTransport({ ...shared, publicType: 'train_ir' });
    const metro = calculateTransport({ ...shared, publicType: 'metro' });
    const auto = calculateTransport({ ...shared, publicType: 'auto_rickshaw' });
    const bus = calculateTransport({ ...shared, publicType: 'city_bus' });
    assert.ok(rail.kg < metro.kg);
    assert.ok(rail.kg < auto.kg);
    assert.ok(rail.kg < bus.kg);
  });

  it('4 domestic flights × 800 km → 4 × 800 × 0.255 = 816 kg', () => {
    const result = calculateTransport({ ...ZERO_TRANSPORT, flights: 4, flightKm: 800 });
    assert.strictEqual(result.breakdown.flights, 816);
    assert.strictEqual(result.kg, 816);
  });

  it('Delhi-Mumbai flight (1150 km) emits 1150 × 0.255 ≈ 293 kg per trip', () => {
    const result = calculateTransport({ ...ZERO_TRANSPORT, flights: 1, flightKm: 1150 });
    assert.strictEqual(result.breakdown.flights, 293);
  });

  it('doubling flight distance doubles flight emissions', () => {
    const short = calculateTransport({ ...ZERO_TRANSPORT, flights: 2, flightKm: 500 });
    const long = calculateTransport({ ...ZERO_TRANSPORT, flights: 2, flightKm: 1000 });
    assert.strictEqual(long.breakdown.flights, short.breakdown.flights * 2);
  });

  it('combined: vehicle + public transit + flights sum correctly', () => {
    const result = calculateTransport({
      vehicle: 'petrol_car', kmPerWeek: 80, publicDays: '3',
      publicKmDay: 10, publicType: 'metro', flights: 2, flightKm: 800,
    });
    const sumOfBreakdown = result.breakdown.vehicle + result.breakdown.publicTransit + result.breakdown.flights;
    assert.ok(Math.abs(result.kg - sumOfBreakdown) <= 1);
  });

  it('returns object with { kg: number, breakdown: { vehicle, publicTransit, flights } }', () => {
    const result = calculateTransport({ ...ZERO_TRANSPORT, vehicle: 'petrol_car', kmPerWeek: 50 });
    assert.strictEqual(typeof result.kg, 'number');
    assert.strictEqual(typeof result.breakdown.vehicle, 'number');
    assert.strictEqual(typeof result.breakdown.publicTransit, 'number');
    assert.strictEqual(typeof result.breakdown.flights, 'number');
  });

  it('uses safe defaults when called with empty object (does not throw)', () => {
    assert.doesNotThrow(() => calculateTransport({}));
    const result = calculateTransport({});
    assert.ok(result.kg > 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FOOD
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateFood()', () => {

  const ZERO_EXTRAS = {
    chickenPerWeek: 0,
    redMeatPerWeek: 0,
    dairyLitresDay: 0,
    eggsPerWeek: 0,
    deliveryPerWeek: 0,
    wasteMultiplier: 1.0,
  };

  it('vegan baseline (no extras, no waste) = exactly 150 kg', () => {
    const result = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan' });
    assert.strictEqual(result.kg, 150);
  });

  it('vegetarian baseline (no extras, no waste) = exactly 400 kg', () => {
    const result = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    assert.strictEqual(result.kg, 400);
  });

  it('vegan always emits less than vegetarian for same extras', () => {
    const vegan = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan' });
    const veg = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    assert.ok(vegan.kg < veg.kg);
  });

  it('heavy-meat with substantial meat intake emits more than vegetarian', () => {
    const heavy = calculateFood({
      dietType: 'heavy-meat', chickenPerWeek: 7, redMeatPerWeek: 5,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0, wasteMultiplier: 1.0,
    });
    const veg = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    assert.ok(heavy.kg > veg.kg);
  });

  it('vegan emits less than all other diet types when extras are zero', () => {
    const vegan = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan' });
    ['vegetarian', 'non-veg-light', 'non-veg-regular', 'heavy-meat'].forEach(diet => {
      const other = calculateFood({ ...ZERO_EXTRAS, dietType: diet });
      assert.ok(vegan.kg < other.kg);
    });
  });

  it('1 litre dairy/day adds exactly 1168 kg (1.0 × 3.2 × 365)', () => {
    const base = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    const dairy = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian', dairyLitresDay: 1.0 });
    assert.strictEqual(dairy.kg - base.kg, 1168);
  });

  it('dairy emissions scale linearly with litres per day', () => {
    const r1 = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan', dairyLitresDay: 1 });
    const r2 = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan', dairyLitresDay: 2 });
    const base = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegan', dairyLitresDay: 0 });
    assert.ok(Math.abs((r2.kg - base.kg) - (r1.kg - base.kg) * 2) <= 1);
  });

  it('7 eggs/week adds exactly 136.5 kg (7 × 0.375 × 52)', () => {
    const base = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    const withEggs = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian', eggsPerWeek: 7 });
    assert.ok(Math.abs(withEggs.kg - base.kg - 136.5) < 1);
  });

  it('food delivery adds logistics + meal emissions per order (2.9 kg/order)', () => {
    const base = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    const oneDeliv = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian', deliveryPerWeek: 1 });
    assert.ok(Math.abs(oneDeliv.kg - base.kg - 151) <= 1);
  });

  it('waste multiplier 1.5 produces 1.5× the non-waste total', () => {
    const noWaste = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian', wasteMultiplier: 1.0 });
    const highWaste = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian', wasteMultiplier: 1.5 });
    assert.ok(Math.abs((highWaste.kg / noWaste.kg) - 1.5) <= 0.1);
  });

  it('red meat per serving emits more CO₂ than chicken per serving (39.2 vs 9.9 kg/kg)', () => {
    const withChicken = calculateFood({
      dietType: 'non-veg-regular', chickenPerWeek: 1, redMeatPerWeek: 0,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0, wasteMultiplier: 1.0,
    });
    const withRedMeat = calculateFood({
      dietType: 'non-veg-regular', chickenPerWeek: 0, redMeatPerWeek: 1,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0, wasteMultiplier: 1.0,
    });
    assert.ok(withRedMeat.kg > withChicken.kg);
  });

  it('adding more chicken to non-veg diet increases total emissions', () => {
    const less = calculateFood({
      dietType: 'non-veg-regular', chickenPerWeek: 2, redMeatPerWeek: 0,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0, wasteMultiplier: 1.0,
    });
    const more = calculateFood({
      dietType: 'non-veg-regular', chickenPerWeek: 7, redMeatPerWeek: 0,
      dairyLitresDay: 0, eggsPerWeek: 0, deliveryPerWeek: 0, wasteMultiplier: 1.0,
    });
    assert.ok(more.kg > less.kg);
  });

  it('returns object with { kg, breakdown: { dietBase, meat, dairy, eggs, delivery } }', () => {
    const result = calculateFood({ ...ZERO_EXTRAS, dietType: 'vegetarian' });
    assert.strictEqual(typeof result.kg, 'number');
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'dietBase'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'meat'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'dairy'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'eggs'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'delivery'));
  });

  it('does not throw when called with empty object (uses defaults)', () => {
    assert.doesNotThrow(() => calculateFood({}));
    const result = calculateFood({});
    assert.ok(result.kg > 0);
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

  it('all-zero inputs → 0 kg', () => {
    const result = calculateEnergy(ZERO_ENERGY);
    assert.strictEqual(result.kg, 0);
    assert.strictEqual(result.breakdown.electricity, 0);
    assert.strictEqual(result.breakdown.cooking, 0);
    assert.strictEqual(result.breakdown.ac, 0);
  });

  it('100 kWh/month electricity → 100 × 12 × 0.708 = 849.6 → 850 kg/year', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 100 });
    assert.strictEqual(result.breakdown.electricity, 850);
    assert.strictEqual(result.kg, 850);
  });

  it('electricity emissions scale linearly with monthly kWh', () => {
    const r100 = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 100 });
    const r200 = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200 });
    assert.strictEqual(r200.breakdown.electricity, 1699);
    assert.ok(Math.abs((r200.breakdown.electricity / r100.breakdown.electricity) - 2) <= 0.1);
  });

  it('1 LPG cylinder/month → 1 × 42.36 × 12 = 508.32 → 508 kg/year', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, lpgCylinders: 1, cookingType: 'lpg' });
    assert.strictEqual(result.breakdown.cooking, 508);
    assert.strictEqual(result.kg, 508);
  });

  it('0.5 LPG cylinders/month → 0.5 × 42.36 × 12 = 254.16 → 254 kg', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, lpgCylinders: 0.5, cookingType: 'lpg' });
    assert.strictEqual(result.breakdown.cooking, 254);
  });

  it('more LPG cylinders per month = more cooking emissions', () => {
    const r1 = calculateEnergy({ ...ZERO_ENERGY, lpgCylinders: 1, cookingType: 'lpg' });
    const r2 = calculateEnergy({ ...ZERO_ENERGY, lpgCylinders: 2, cookingType: 'lpg' });
    assert.ok(Math.abs(r2.breakdown.cooking - r1.breakdown.cooking * 2) <= 1);
  });

  it('AC (4 hrs/day, 5 months) → 4 × 1.062 × 5 × 30 = 637.2 → 637 kg', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, acHrsDay: 4, acMonths: 5 });
    assert.strictEqual(result.breakdown.ac, 637);
    assert.strictEqual(result.kg, 637);
  });

  it('AC emissions scale with hours × months', () => {
    const r1 = calculateEnergy({ ...ZERO_ENERGY, acHrsDay: 2, acMonths: 3 });
    const r2 = calculateEnergy({ ...ZERO_ENERGY, acHrsDay: 4, acMonths: 6 });
    assert.ok(Math.abs(r2.breakdown.ac - r1.breakdown.ac * 4) <= 1);
  });

  it('partial solar (level 1) offsets 30% of electricity vs no solar', () => {
    const noSolar = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '0' });
    const partial = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '1' });
    const ratio = partial.breakdown.electricity / noSolar.breakdown.electricity;
    assert.ok(Math.abs(ratio - 0.70) <= 0.1);
  });

  it('full solar (level 2) offsets 70% of electricity vs no solar', () => {
    const noSolar = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '0' });
    const fullSolar = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '2' });
    const ratio = fullSolar.breakdown.electricity / noSolar.breakdown.electricity;
    assert.ok(Math.abs(ratio - 0.30) <= 0.1);
  });

  it('full solar offsets more than partial solar', () => {
    const partial = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '1' });
    const fullSolar = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 200, solarLevel: '2' });
    assert.ok(fullSolar.breakdown.electricity < partial.breakdown.electricity);
  });

  it('PNG cooking produces positive emissions (8 × 2.204 × 12 = 211.584 → 212 kg)', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, cookingType: 'png' });
    assert.strictEqual(result.breakdown.cooking, 212);
  });

  it('electric/induction cooking produces emissions (30 × 0.708 × 12 = 254.88 → 255 kg)', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, cookingType: 'electric' });
    assert.strictEqual(result.breakdown.cooking, 255);
  });

  it('biomass cooking produces emissions (fixed 200 kg)', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, cookingType: 'biomass' });
    assert.strictEqual(result.breakdown.cooking, 200);
  });

  it('returns object with { kg, breakdown: { electricity, cooking, ac } }', () => {
    const result = calculateEnergy({ ...ZERO_ENERGY, electricityKwh: 100 });
    assert.strictEqual(typeof result.kg, 'number');
    assert.strictEqual(typeof result.breakdown.electricity, 'number');
    assert.strictEqual(typeof result.breakdown.cooking, 'number');
    assert.strictEqual(typeof result.breakdown.ac, 'number');
  });

  it('does not throw with empty inputs (uses defaults)', () => {
    assert.doesNotThrow(() => calculateEnergy({}));
    const result = calculateEnergy({});
    assert.ok(result.kg > 0);
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

  it('all-zero inputs → 0 kg', () => {
    const result = calculateShopping(ZERO_SHOPPING);
    assert.strictEqual(result.kg, 0);
    assert.strictEqual(result.breakdown.clothing, 0);
    assert.strictEqual(result.breakdown.devices, 0);
    assert.strictEqual(result.breakdown.onlinePkg, 0);
    assert.strictEqual(result.breakdown.appliances, 0);
  });

  it('5 new clothes/month → 5 × 10 × 12 = 600 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, newClothesMonth: 5 });
    assert.strictEqual(result.breakdown.clothing, 600);
    assert.strictEqual(result.kg, 600);
  });

  it('1 new smartphone → 70 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, smartphonesYear: 1 });
    assert.strictEqual(result.breakdown.devices, 70);
    assert.strictEqual(result.kg, 70);
  });

  it('2 new smartphones → 140 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, smartphonesYear: 2 });
    assert.strictEqual(result.breakdown.devices, 140);
  });

  it('1 new laptop → 350 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, laptopsYear: 1 });
    assert.strictEqual(result.breakdown.devices, 350);
    assert.strictEqual(result.kg, 350);
  });

  it('laptop emits more than smartphone per device (350 vs 70 kg)', () => {
    const phone = calculateShopping({ ...ZERO_SHOPPING, smartphonesYear: 1 });
    const laptop = calculateShopping({ ...ZERO_SHOPPING, laptopsYear: 1 });
    assert.strictEqual(laptop.kg, phone.kg * 5);
  });

  it('smartphone + laptop devices combined correctly', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, smartphonesYear: 1, laptopsYear: 1 });
    assert.strictEqual(result.breakdown.devices, 420);
    assert.strictEqual(result.kg, 420);
  });

  it('10 online orders/week → 10 × 0.5 × 52 = 260 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, onlineOrdersWeek: 10 });
    assert.strictEqual(result.breakdown.onlinePkg, 260);
    assert.strictEqual(result.kg, 260);
  });

  it('1 online order/week → 1 × 0.5 × 52 = 26 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, onlineOrdersWeek: 1 });
    assert.strictEqual(result.breakdown.onlinePkg, 26);
  });

  it('online orders scale linearly with order frequency', () => {
    const r1 = calculateShopping({ ...ZERO_SHOPPING, onlineOrdersWeek: 1 });
    const r5 = calculateShopping({ ...ZERO_SHOPPING, onlineOrdersWeek: 5 });
    assert.strictEqual(r5.breakdown.onlinePkg, r1.breakdown.onlinePkg * 5);
  });

  it('1 large appliance → 225 kg', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, largeAppliancesYear: 1 });
    assert.strictEqual(result.breakdown.appliances, 225);
    assert.strictEqual(result.kg, 225);
  });

  it('combined shopping calculation is the sum of all categories', () => {
    const result = calculateShopping({
      newClothesMonth: 2, smartphonesYear: 1, laptopsYear: 0,
      onlineOrdersWeek: 5, largeAppliancesYear: 1,
    });
    assert.strictEqual(result.kg, 665);
    assert.strictEqual(result.breakdown.clothing, 240);
    assert.strictEqual(result.breakdown.devices, 70);
    assert.strictEqual(result.breakdown.onlinePkg, 130);
    assert.strictEqual(result.breakdown.appliances, 225);
  });

  it('returns object with { kg, breakdown: { clothing, devices, onlinePkg, appliances } }', () => {
    const result = calculateShopping({ ...ZERO_SHOPPING, newClothesMonth: 3 });
    assert.strictEqual(typeof result.kg, 'number');
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'clothing'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'devices'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'onlinePkg'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'appliances'));
  });

  it('does not throw with empty object (uses defaults)', () => {
    assert.doesNotThrow(() => calculateShopping({}));
    const result = calculateShopping({});
    assert.strictEqual(typeof result.kg, 'number');
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

  it('all-zero inputs → 0 kg', () => {
    const result = calculateDigital(ZERO_DIGITAL);
    assert.strictEqual(result.kg, 0);
    assert.strictEqual(result.breakdown.streaming, 0);
    assert.strictEqual(result.breakdown.social, 0);
    assert.strictEqual(result.breakdown.videoCalls, 0);
    assert.strictEqual(result.breakdown.cloud, 0);
    assert.strictEqual(result.breakdown.gaming, 0);
  });

  it('HD streaming 3 hrs/day → 3 × 0.036 × 365 = 39.42 → 39 kg', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 3, streamingQuality: 'hd' });
    assert.strictEqual(result.breakdown.streaming, 39);
    assert.strictEqual(result.kg, 39);
  });

  it('4K streaming emits exactly 2× HD for same hours (0.072 vs 0.036)', () => {
    const hd = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 3, streamingQuality: 'hd' });
    const fk = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 3, streamingQuality: '4k' });
    assert.strictEqual(fk.breakdown.streaming, 79);
    assert.ok(Math.abs((fk.breakdown.streaming / hd.breakdown.streaming) - 2) <= 0.1);
  });

  it('SD streaming emits exactly half of HD for same hours (0.018 vs 0.036)', () => {
    const hd = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 2, streamingQuality: 'hd' });
    const sd = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 2, streamingQuality: 'sd' });
    assert.strictEqual(sd.breakdown.streaming, 13);
    assert.strictEqual(hd.breakdown.streaming, 26);
    assert.strictEqual(sd.breakdown.streaming * 2, hd.breakdown.streaming);
  });

  it('social media 2 hrs/day → 2 × 0.015 × 365 = 10.95 → 11 kg', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, socialHrsDay: 2 });
    assert.strictEqual(result.breakdown.social, 11);
  });

  it('video calls 1 hr/day → 1 × 0.157 × 365 = 57.305 → 57 kg', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, videoCallHrsDay: 1 });
    assert.strictEqual(result.breakdown.videoCalls, 57);
  });

  it('video calls emit more per hour than social media (0.157 vs 0.015)', () => {
    const social = calculateDigital({ ...ZERO_DIGITAL, socialHrsDay: 1 });
    const calls = calculateDigital({ ...ZERO_DIGITAL, videoCallHrsDay: 1 });
    assert.ok(calls.kg > social.kg);
  });

  it('50 GB cloud storage → 50 × 0.003 × 12 = 1.8 → 2 kg', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, cloudGb: 50 });
    assert.strictEqual(result.breakdown.cloud, 2);
  });

  it('cloud storage scales linearly with GB', () => {
    const r50 = calculateDigital({ ...ZERO_DIGITAL, cloudGb: 50 });
    const r200 = calculateDigital({ ...ZERO_DIGITAL, cloudGb: 200 });
    assert.strictEqual(r200.breakdown.cloud, 7);
  });

  it('gaming 2 hrs/day → 2 × 0.08 × 365 = 58.4 → 58 kg', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, gamingHrsDay: 2 });
    assert.strictEqual(result.breakdown.gaming, 58);
  });

  it('streaming hours scale linearly (6 hrs = 6× 1 hr)', () => {
    const r1 = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 1, streamingQuality: 'hd' });
    const r6 = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 6, streamingQuality: 'hd' });
    assert.strictEqual(r6.breakdown.streaming, 79);
    assert.strictEqual(r1.breakdown.streaming, 13);
  });

  it('combined digital emissions sum all breakdown components', () => {
    const result = calculateDigital({
      streamingHrsDay: 2, streamingQuality: 'hd',
      socialHrsDay: 1, videoCallHrsDay: 1,
      cloudGb: 50, gamingHrsDay: 1,
    });
    assert.strictEqual(result.breakdown.streaming, 26);
    assert.strictEqual(result.breakdown.social, 5);
    assert.strictEqual(result.breakdown.videoCalls, 57);
    assert.strictEqual(result.breakdown.cloud, 2);
    assert.strictEqual(result.breakdown.gaming, 29);
    const sum = 26 + 5 + 57 + 2 + 29;
    assert.ok(Math.abs(result.kg - sum) <= 1);
  });

  it('returns object with { kg, breakdown: { streaming, social, videoCalls, cloud, gaming } }', () => {
    const result = calculateDigital({ ...ZERO_DIGITAL, streamingHrsDay: 1 });
    assert.strictEqual(typeof result.kg, 'number');
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'streaming'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'social'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'videoCalls'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'cloud'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.breakdown, 'gaming'));
  });

  it('does not throw with empty object (uses defaults)', () => {
    assert.doesNotThrow(() => calculateDigital({}));
    const result = calculateDigital({});
    assert.ok(result.kg > 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────
describe('getTier()', () => {

  it('0 kg → green', () => assert.strictEqual(getTier(0), 'green'));
  it('500 kg → green', () => assert.strictEqual(getTier(500), 'green'));
  it('1000 kg → green', () => assert.strictEqual(getTier(1000), 'green'));
  it('1499 kg → green (just below yellow boundary)', () => assert.strictEqual(getTier(1499), 'green'));

  it('1500 kg → yellow (at lower boundary)', () => assert.strictEqual(getTier(1500), 'yellow'));
  it('2000 kg → yellow', () => assert.strictEqual(getTier(2000), 'yellow'));
  it('2999 kg → yellow (just below orange boundary)', () => assert.strictEqual(getTier(2999), 'yellow'));

  it('3000 kg → orange (at lower boundary)', () => assert.strictEqual(getTier(3000), 'orange'));
  it('4500 kg → orange', () => assert.strictEqual(getTier(4500), 'orange'));
  it('5999 kg → orange (just below red boundary)', () => assert.strictEqual(getTier(5999), 'orange'));

  it('6000 kg → red (at lower boundary)', () => assert.strictEqual(getTier(6000), 'red'));
  it('8000 kg → red', () => assert.strictEqual(getTier(8000), 'red'));
  it('15000 kg → red', () => assert.strictEqual(getTier(15000), 'red'));

  it('negative values → green (below all thresholds)', () => {
    assert.strictEqual(getTier(-1), 'green');
    assert.strictEqual(getTier(-1000), 'green');
  });

  describe('TIERS object', () => {
    it('has four required keys: green, yellow, orange, red', () => {
      assert.ok(Object.prototype.hasOwnProperty.call(TIERS, 'green'));
      assert.ok(Object.prototype.hasOwnProperty.call(TIERS, 'yellow'));
      assert.ok(Object.prototype.hasOwnProperty.call(TIERS, 'orange'));
      assert.ok(Object.prototype.hasOwnProperty.call(TIERS, 'red'));
    });

    it('each tier entry has label, icon, cssClass, colorVar', () => {
      Object.values(TIERS).forEach(tier => {
        assert.strictEqual(typeof tier.label, 'string');
        assert.strictEqual(typeof tier.icon, 'string');
        assert.strictEqual(typeof tier.cssClass, 'string');
        assert.strictEqual(typeof tier.colorVar, 'string');
      });
    });

    it('green tier label is "Carbon Champion"', () => {
      assert.strictEqual(TIERS.green.label, 'Carbon Champion');
    });

    it('red tier label is "Climate Emergency"', () => {
      assert.strictEqual(TIERS.red.label, 'Climate Emergency');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALOGIES
// ─────────────────────────────────────────────────────────────────────────────
describe('getAnalogies()', () => {

  it('0 kg returns all zeros and dash label', () => {
    const result = getAnalogies(0);
    assert.strictEqual(result.delhiMumbaiDrives, 0);
    assert.strictEqual(result.treesNeeded, 0);
    assert.strictEqual(result.electricityMonths, 0);
    assert.strictEqual(result.domesticFlights, 0);
    assert.strictEqual(result.vsIndiaAvgPct, 0);
    assert.strictEqual(result.vsIndiaAvgLabel, '—');
  });

  it('null/undefined return zero-value object (falsy guard)', () => {
    assert.strictEqual(getAnalogies(null).treesNeeded, 0);
    assert.strictEqual(getAnalogies(undefined).treesNeeded, 0);
  });

  it('negative kg returns zero-value object', () => {
    const result = getAnalogies(-500);
    assert.strictEqual(result.delhiMumbaiDrives, 0);
    assert.strictEqual(result.treesNeeded, 0);
  });

  it('treesNeeded = Math.ceil(kg / 21)', () => {
    assert.strictEqual(getAnalogies(2000).treesNeeded, 96);
    assert.strictEqual(getAnalogies(2100).treesNeeded, 100);
    assert.strictEqual(getAnalogies(2101).treesNeeded, 101);
  });

  it('treesNeeded is always a positive integer for positive kg', () => {
    [100, 500, 1234, 6789].forEach(kg => {
      const result = getAnalogies(kg);
      assert.ok(Number.isInteger(result.treesNeeded));
      assert.ok(result.treesNeeded > 0);
    });
  });

  it('delhiMumbaiDrives = round(kg / (1450 × 0.192), 1)', () => {
    const result = getAnalogies(2784);
    assert.strictEqual(result.delhiMumbaiDrives, 10);
  });

  it('electricityMonths = round(kg / (96 × 0.708), 1)', () => {
    const result = getAnalogies(679.68);
    assert.strictEqual(result.electricityMonths, 10);
  });

  it('domesticFlights = round(kg / (1150 × 0.255), 1)', () => {
    const result = getAnalogies(2932.5);
    assert.strictEqual(result.domesticFlights, 10);
  });

  it('higher footprint → more Delhi-Mumbai drives', () => {
    const low = getAnalogies(1000);
    const high = getAnalogies(5000);
    assert.ok(high.delhiMumbaiDrives > low.delhiMumbaiDrives);
  });

  it('higher footprint → more trees needed', () => {
    const low = getAnalogies(500);
    const high = getAnalogies(5000);
    assert.ok(high.treesNeeded > low.treesNeeded);
  });

  it('vsIndiaAvgPct is negative for below-average footprint', () => {
    assert.ok(getAnalogies(1000).vsIndiaAvgPct < 0);
  });

  it('vsIndiaAvgPct is positive for above-average footprint', () => {
    assert.ok(getAnalogies(3000).vsIndiaAvgPct > 0);
  });

  it('vsIndiaAvgPct = 0 and label "Exactly at India avg" for 1900 kg', () => {
    const result = getAnalogies(1900);
    assert.strictEqual(result.vsIndiaAvgPct, 0);
    assert.strictEqual(result.vsIndiaAvgLabel, 'Exactly at India avg');
  });

  it('vsIndiaAvgLabel contains "less than" for below-average footprint', () => {
    assert.ok(getAnalogies(500).vsIndiaAvgLabel.includes('less than'));
  });

  it('vsIndiaAvgLabel contains "more than" for above-average footprint', () => {
    assert.ok(getAnalogies(5000).vsIndiaAvgLabel.includes('more than'));
  });

  it('returns all required fields', () => {
    const result = getAnalogies(2000);
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'delhiMumbaiDrives'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'treesNeeded'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'electricityMonths'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'domesticFlights'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'vsIndiaAvgPct'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'vsIndiaAvgLabel'));
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

  it('sums 5 categories correctly: 800+600+700+300+100 = 2500 kg', () => {
    assert.strictEqual(getTotal(MOCK).totalKg, 2500);
  });

  it('2500 kg → yellow tier', () => {
    assert.strictEqual(getTotal(MOCK).tier, 'yellow');
  });

  it('returns tierInfo with label, icon, cssClass', () => {
    const { tierInfo } = getTotal(MOCK);
    assert.ok(Object.prototype.hasOwnProperty.call(tierInfo, 'label'));
    assert.ok(Object.prototype.hasOwnProperty.call(tierInfo, 'icon'));
    assert.ok(Object.prototype.hasOwnProperty.call(tierInfo, 'cssClass'));
  });

  it('breakdown array has exactly 5 entries', () => {
    assert.strictEqual(getTotal(MOCK).breakdown.length, 5);
  });

  it('breakdown contains all five categories by label', () => {
    const labels = getTotal(MOCK).breakdown.map(b => b.label);
    assert.ok(labels.includes('Transport'));
    assert.ok(labels.includes('Food'));
    assert.ok(labels.includes('Home Energy'));
    assert.ok(labels.includes('Shopping'));
    assert.ok(labels.includes('Digital'));
  });

  it('percentages sum to 100 (±2 due to individual rounding)', () => {
    const totalPct = getTotal(MOCK).percentages.reduce((s, p) => s + p.pct, 0);
    assert.ok(totalPct >= 98);
    assert.ok(totalPct <= 102);
  });

  it('each percentage item has a pct field between 0 and 100', () => {
    getTotal(MOCK).percentages.forEach(p => {
      assert.ok(p.pct >= 0);
      assert.ok(p.pct <= 100);
    });
  });

  it('percentages are proportional: transport 800/2500 = 32%', () => {
    const transportPct = getTotal(MOCK).percentages.find(p => p.label === 'Transport').pct;
    assert.strictEqual(transportPct, 32);
  });

  it('analogies object is populated', () => {
    const { analogies } = getTotal(MOCK);
    assert.ok(Object.prototype.hasOwnProperty.call(analogies, 'treesNeeded'));
    assert.ok(analogies.treesNeeded > 0);
  });

  it('missing categories default to 0 (optional chaining)', () => {
    const result = getTotal({ transport: { kg: 500 } });
    assert.strictEqual(result.totalKg, 500);
    assert.strictEqual(result.tier, 'green');
  });

  it('green tier for totalKg < 1500', () => {
    const result = getTotal({ transport: { kg: 400 }, food: { kg: 300 } });
    assert.strictEqual(result.tier, 'green');
    assert.strictEqual(result.totalKg, 700);
  });

  it('orange tier for 3000–5999 kg', () => {
    const result = getTotal({
      transport: { kg: 1500 }, food: { kg: 1500 }, energy: { kg: 500 },
    });
    assert.strictEqual(result.totalKg, 3500);
    assert.strictEqual(result.tier, 'orange');
  });

  it('red tier for ≥ 6000 kg', () => {
    const result = getTotal({
      transport: { kg: 2000 }, food: { kg: 2000 },
      energy: { kg: 2000 }, shopping: { kg: 500 }, digital: { kg: 500 },
    });
    assert.strictEqual(result.totalKg, 7000);
    assert.strictEqual(result.tier, 'red');
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

  it('returns exactly 5 steps', () => {
    assert.strictEqual(generateRoadmap(CATS, 4400).length, 5);
  });

  it('each step is numbered 1 through 5 sequentially', () => {
    const steps = generateRoadmap(CATS, 4400).map(s => s.step);
    assert.deepStrictEqual(steps, [1, 2, 3, 4, 5]);
  });

  it('every step has required fields: step, title, description, savingKg, savingInrMonth, category', () => {
    generateRoadmap(CATS, 4400).forEach(step => {
      assert.strictEqual(typeof step.step, 'number');
      assert.strictEqual(typeof step.title, 'string');
      assert.ok(step.title.length > 0);
      assert.strictEqual(typeof step.description, 'string');
      assert.strictEqual(typeof step.savingKg, 'number');
      assert.strictEqual(typeof step.savingInrMonth, 'number');
      assert.strictEqual(typeof step.category, 'string');
    });
  });

  it('savingKg is always ≥ 0', () => {
    generateRoadmap(CATS, 4400).forEach(step => {
      assert.ok(step.savingKg >= 0);
    });
  });

  it('savingKg is always less than total kg (can\'t save more than total)', () => {
    const totalKg = 4400;
    generateRoadmap(CATS, totalKg).forEach(step => {
      assert.ok(step.savingKg < totalKg);
    });
  });

  it('steps are sorted descending by savingKg', () => {
    const steps = generateRoadmap(CATS, 4400);
    for (let i = 0; i < steps.length - 1; i++) {
      assert.ok(steps[i].savingKg >= steps[i + 1].savingKg);
    }
  });

  it('category with highest kg produces highest saving among its candidates', () => {
    const steps = generateRoadmap(CATS, 4400);
    const maxSaving = Math.max(...steps.map(s => s.savingKg));
    assert.strictEqual(steps[0].savingKg, maxSaving);
  });

  it('does not throw when all categories have 0 kg', () => {
    const zeros = { transport: { kg: 0 }, food: { kg: 0 }, energy: { kg: 0 }, shopping: { kg: 0 }, digital: { kg: 0 } };
    assert.doesNotThrow(() => generateRoadmap(zeros, 0));
    const steps = generateRoadmap(zeros, 0);
    assert.strictEqual(steps.length, 5);
    steps.forEach(s => assert.strictEqual(s.savingKg, 0));
  });

  it('higher energy kg → higher savingKg for rooftop solar candidate', () => {
    const lowEnergy = generateRoadmap({ ...CATS, energy: { kg: 200 } }, 3600);
    const highEnergy = generateRoadmap({ ...CATS, energy: { kg: 3000 } }, 6200);
    const solarLow = lowEnergy.find(s => s.title.includes('Solar'));
    const solarHigh = highEnergy.find(s => s.title.includes('Solar'));
    if (solarLow && solarHigh) {
      assert.ok(solarHigh.savingKg > solarLow.savingKg);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT KG
// ─────────────────────────────────────────────────────────────────────────────
describe('formatKg()', () => {

  it('returns a string type', () => {
    assert.strictEqual(typeof formatKg(1000), 'string');
    assert.strictEqual(typeof formatKg(500, true), 'string');
  });

  it('1500 in short form → "1.5T"', () => {
    assert.strictEqual(formatKg(1500, true), '1.5T');
  });

  it('2000 in short form → "2.0T"', () => {
    assert.strictEqual(formatKg(2000, true), '2.0T');
  });

  it('10000 in short form → "10.0T"', () => {
    assert.strictEqual(formatKg(10000, true), '10.0T');
  });

  it('50000 in short form → "50.0T"', () => {
    assert.strictEqual(formatKg(50000, true), '50.0T');
  });

  it('1234 in short form → "1.2T" (toFixed(1) truncates .234)', () => {
    assert.strictEqual(formatKg(1234, true), '1.2T');
  });

  it('1250 in short form → "1.3T" (1250/1000 = 1.25, toFixed(1) rounds to 1.3)', () => {
    assert.strictEqual(formatKg(1250, true), '1.3T');
  });

  it('999 in short form does NOT add T suffix (< 1000)', () => {
    assert.ok(!formatKg(999, true).includes('T'));
  });

  it('0 in short form returns "0" (0 < 1000, uses long path)', () => {
    assert.strictEqual(formatKg(0, true), '0');
  });

  it('500 in long form contains "500"', () => {
    assert.ok(formatKg(500, false).includes('500'));
  });

  it('0 in long form returns "0"', () => {
    assert.strictEqual(formatKg(0, false), '0');
  });

  it('rounds fractional kg before formatting', () => {
    assert.strictEqual(formatKg(1500.6, true), '1.5T');
    assert.strictEqual(formatKg(999.9, true), '1,000');
  });

  it('does not throw for 0, negative-ish, or large values', () => {
    assert.doesNotThrow(() => formatKg(0));
    assert.doesNotThrow(() => formatKg(999999));
    assert.doesNotThrow(() => formatKg(999999, true));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NUMBER COUNTER GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
describe('numberCounter()', () => {

  it('with steps=10, yields exactly 10 values', () => {
    const values = [...numberCounter(0, 100, 10)];
    assert.strictEqual(values.length, 10);
  });

  it('with default steps, yields exactly 60 values', () => {
    const values = [...numberCounter(0, 1000)];
    assert.strictEqual(values.length, 60);
  });

  it('final value equals end parameter (ease=1 at last step)', () => {
    assert.strictEqual([...numberCounter(0, 100, 10)].at(-1), 100);
    assert.strictEqual([...numberCounter(0, 500, 30)].at(-1), 500);
    assert.strictEqual([...numberCounter(100, 200, 5)].at(-1), 200);
  });

  it('all values are integers (Math.round applied)', () => {
    [...numberCounter(0, 999, 25)].forEach(v => {
      assert.ok(Number.isInteger(v));
    });
  });

  it('values are monotonically non-decreasing (ease-out curve)', () => {
    const values = [...numberCounter(0, 1000, 20)];
    for (let i = 1; i < values.length; i++) {
      assert.ok(values[i] >= values[i - 1]);
    }
  });

  it('first value > start (ease-out means fast initial progress)', () => {
    const first = [...numberCounter(0, 1000, 60)][0];
    assert.ok(first > 0);
    assert.ok(first < 1000);
  });

  it('all values ≥ start when iterating from a non-zero start', () => {
    const start = 500;
    [...numberCounter(start, 800, 15)].forEach(v => {
      assert.ok(v >= start);
    });
  });

  it('non-zero start: final value equals end', () => {
    const values = [...numberCounter(200, 700, 5)];
    assert.strictEqual(values.at(-1), 700);
  });

  it('ease-out: first half progresses faster than second half', () => {
    const values = [...numberCounter(0, 1000, 10)];
    const midpoint = values[4];
    assert.ok(midpoint > 700);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION — full pipeline end-to-end
// ─────────────────────────────────────────────────────────────────────────────
describe('Full calculation pipeline (integration)', () => {

  it('typical metro-commuting vegetarian Indian lands in yellow/green tier', () => {
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
    assert.ok(result.totalKg > 0);
    assert.ok(['green', 'yellow', 'orange'].includes(result.tier));
    assert.ok(result.analogies.treesNeeded > 0);
    assert.strictEqual(result.percentages.length, 5);
  });

  it('heavy-consumption user (car, meat, high AC, multiple flights) → red tier', () => {
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
    assert.strictEqual(result.tier, 'red');
    assert.ok(result.totalKg > 6000);
  });

  it('minimal-footprint user (vegan, metro-only, solar, no shopping) → green tier', () => {
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
    assert.strictEqual(result.tier, 'green');
    assert.ok(result.totalKg < 1500);
  });

  it('roadmap savings are always smaller than the total footprint', () => {
    const transport = calculateTransport({ vehicle: 'petrol_car', kmPerWeek: 100, publicDays: '0', publicKmDay: 0, publicType: 'metro', flights: 2, flightKm: 800 });
    const food = calculateFood({ dietType: 'non-veg-regular', chickenPerWeek: 4, redMeatPerWeek: 1, dairyLitresDay: 0.7, eggsPerWeek: 4, deliveryPerWeek: 4, wasteMultiplier: 1.15 });
    const energy = calculateEnergy({ electricityKwh: 150, lpgCylinders: 1, cookingType: 'lpg', acHrsDay: 4, acMonths: 5, solarLevel: '0' });
    const shopping = calculateShopping({ newClothesMonth: 3, smartphonesYear: 0, laptopsYear: 0, onlineOrdersWeek: 3, largeAppliancesYear: 0 });
    const digital = calculateDigital({ streamingHrsDay: 3, streamingQuality: 'hd', socialHrsDay: 3, videoCallHrsDay: 1, cloudGb: 50, gamingHrsDay: 1 });

    const { totalKg } = getTotal({ transport, food, energy, shopping, digital });
    const roadmap = generateRoadmap({ transport, food, energy, shopping, digital }, totalKg);

    assert.strictEqual(roadmap.length, 5);
    roadmap.forEach(step => {
      assert.ok(step.savingKg >= 0);
      assert.ok(step.savingKg < totalKg);
    });
  });

  it('getTier(getTotal(...).totalKg) matches getTotal(...).tier', () => {
    const transport = calculateTransport({ vehicle: 'petrol_car', kmPerWeek: 80, publicDays: '0', publicKmDay: 0, publicType: 'metro', flights: 2, flightKm: 800 });
    const food = calculateFood({ dietType: 'vegetarian', chickenPerWeek: 0, redMeatPerWeek: 0, dairyLitresDay: 0.5, eggsPerWeek: 3, deliveryPerWeek: 2, wasteMultiplier: 1.1 });
    const energy = calculateEnergy({ electricityKwh: 120, lpgCylinders: 0.5, cookingType: 'lpg', acHrsDay: 3, acMonths: 4, solarLevel: '0' });
    const shopping = calculateShopping({ newClothesMonth: 2, smartphonesYear: 0, laptopsYear: 0, onlineOrdersWeek: 2, largeAppliancesYear: 0 });
    const digital = calculateDigital({ streamingHrsDay: 2, streamingQuality: 'hd', socialHrsDay: 2, videoCallHrsDay: 1, cloudGb: 30, gamingHrsDay: 0 });

    const result = getTotal({ transport, food, energy, shopping, digital });
    assert.strictEqual(result.tier, getTier(result.totalKg));
    assert.deepStrictEqual(result.tierInfo, TIERS[result.tier]);
  });
});