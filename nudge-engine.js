/**
 * nudge-engine.js
 * CarbonMirror — AI Decision Scanner & Carbon Nudge Engine
 * Gemini API integration with comprehensive rule-based fallback.
 * No secrets stored in code — API key from sessionStorage only.
 */

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL    = 'gemini-1.5-flash';
const SESSION_KEY     = 'carbonmirror_gemini_key';

// ─── API KEY MANAGEMENT ──────────────────────────────────────────────────────

/**
 * Save Gemini API key to sessionStorage only.
 * @param {string} key
 */
export function saveApiKey(key) {
  if (!key || typeof key !== 'string') return false;
  const cleaned = key.trim();
  if (!cleaned.startsWith('AIza') && cleaned.length < 20) return false;
  sessionStorage.setItem(SESSION_KEY, cleaned);
  return true;
}

/**
 * Retrieve Gemini API key from sessionStorage.
 * @returns {string|null}
 */
export function getApiKey() {
  return sessionStorage.getItem(SESSION_KEY);
}

/**
 * Clear the stored API key.
 */
export function clearApiKey() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Check if an API key is available.
 * @returns {boolean}
 */
export function hasApiKey() {
  const key = getApiKey();
  return !!key && key.length > 10;
}

/**
 * Return a masked display version of the key.
 * @returns {string}
 */
export function getMaskedKey() {
  const key = getApiKey();
  if (!key) return '';
  const visible = key.slice(-4);
  return '●'.repeat(8) + visible;
}

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are CarbonMirror's carbon footprint expert for India.
When the user describes an action they are about to take, respond ONLY with valid JSON in this exact structure:
{
  "estimatedCO2Kg": <number, annual or one-time as appropriate>,
  "isAnnual": <boolean — true if kg is annual, false if one-time>,
  "actionSummary": "<short label for the action, max 8 words>",
  "context": "<one sentence explaining the carbon estimate>",
  "alternatives": [
    {
      "action": "<alternative action description>",
      "co2Kg": <number — CO2 for the alternative>,
      "savingKg": <number — savings vs original>,
      "savingPct": <integer — percentage saving>
    },
    {
      "action": "<second alternative>",
      "co2Kg": <number>,
      "savingKg": <number>,
      "savingPct": <integer>
    }
  ],
  "analogy": "<emotional analogy using Indian references: trees, train journeys, Delhi-Mumbai drives, electricity bills, etc. Make it visceral and relatable for an urban Indian 18-35 year old.>"
}
Rules:
- Use Indian emission factors (IEA 2023: 0.708 kg CO2/kWh for grid electricity, IPCC for food)
- estimatedCO2Kg should be realistic (e.g., one chicken biryani order ≈ 2.1 kg, one Delhi-Mumbai flight ≈ 295 kg)
- Keep alternatives practical and affordable for middle-class urban India
- The analogy must be emotionally resonant — not just factual
- Return ONLY the JSON object, no markdown, no explanations`;

// ─── GEMINI API CALL ─────────────────────────────────────────────────────────

/**
 * Call Gemini API to analyze an action's carbon impact.
 * @param {string} userAction - The action to analyze
 * @returns {Promise<NudgeResult>}
 */
export async function analyzeWithGemini(userAction) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key available');

  // Sanitize input
  const sanitized = sanitizeInput(userAction);
  if (!sanitized) throw new Error('Invalid input');

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [{
      role: 'user',
      parts: [{ text: `Analyze the carbon footprint of this action: "${sanitized}"` }]
    }],
    generationConfig: {
      temperature:     0.3,
      maxOutputTokens: 600,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  const response = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg  = errBody?.error?.message ?? `API error ${response.status}`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('Empty response from Gemini');

  // Parse and validate JSON
  const parsed = parseGeminiResponse(text);
  return parsed;
}

/**
 * Parse and validate Gemini JSON response.
 * @param {string} text
 * @returns {NudgeResult}
 */
function parseGeminiResponse(text) {
  let json;
  try {
    // Strip markdown code fences if present
    const clean = text.replace(/```json\n?|```\n?/g, '').trim();
    json = JSON.parse(clean);
  } catch {
    throw new Error('Failed to parse Gemini response as JSON');
  }

  // Validate required fields
  if (typeof json.estimatedCO2Kg !== 'number') throw new Error('Invalid response: missing estimatedCO2Kg');
  if (!Array.isArray(json.alternatives) || json.alternatives.length < 1) throw new Error('Invalid response: missing alternatives');

  return {
    estimatedCO2Kg: Math.max(0, json.estimatedCO2Kg),
    isAnnual:       json.isAnnual ?? false,
    actionSummary:  sanitizeOutput(json.actionSummary ?? 'This action'),
    context:        sanitizeOutput(json.context ?? ''),
    alternatives:   json.alternatives.slice(0, 2).map(a => ({
      action:     sanitizeOutput(a.action ?? 'Alternative'),
      co2Kg:      Math.max(0, Number(a.co2Kg) || 0),
      savingKg:   Math.max(0, Number(a.savingKg) || 0),
      savingPct:  Math.max(0, Math.min(100, Number(a.savingPct) || 0)),
    })),
    analogy:        sanitizeOutput(json.analogy ?? ''),
    source:         'gemini',
  };
}

// ─── RULE-BASED FALLBACK ─────────────────────────────────────────────────────

/**
 * Keyword-based rule engine for carbon estimation.
 * @param {string} userAction
 * @returns {NudgeResult}
 */
export function analyzeWithRules(userAction) {
  const text = userAction.toLowerCase();
  const rule  = findBestRule(text);

  if (rule) return rule;

  // Generic fallback
  return {
    estimatedCO2Kg: 2.5,
    isAnnual:       false,
    actionSummary:  'Your action',
    context:        'Estimated based on typical Indian consumption patterns.',
    alternatives: [
      { action: 'Choose a plant-based alternative', co2Kg: 0.8, savingKg: 1.7, savingPct: 68 },
      { action: 'Reduce frequency by half',         co2Kg: 1.25, savingKg: 1.25, savingPct: 50 },
    ],
    analogy: 'This generates about as much CO₂ as keeping a ceiling fan running for 50 hours — small but it adds up.',
    source:  'rules',
  };
}

// Rule database
const RULE_PATTERNS = [
  // ── FOOD ────────────────────────────────────────────────────────────────
  {
    keywords: ['chicken biryani', 'biryani', 'chicken'],
    co2: 2.1, isAnnual: false,
    summary: 'Chicken Biryani (one serving)',
    context: 'Chicken production (9.9 kg CO₂/kg) plus cooking and delivery logistics.',
    alternatives: [
      { action: 'Veg biryani or paneer biryani',           co2Kg: 0.6, savingKg: 1.5, savingPct: 71 },
      { action: 'Home-cooked dal-chawal (lentils + rice)',  co2Kg: 0.3, savingKg: 1.8, savingPct: 86 },
    ],
    analogy: 'One chicken biryani emits as much CO₂ as driving a scooter 20 km. 3 biryanis/week = 1 full Delhi-Mumbai drive per year.',
  },
  {
    keywords: ['mutton', 'red meat', 'lamb', 'beef'],
    co2: 6.5, isAnnual: false,
    summary: 'Red Meat Meal (mutton/lamb)',
    context: 'Mutton/lamb has one of the highest carbon footprints (39 kg CO₂/kg) due to methane from livestock.',
    alternatives: [
      { action: 'Chicken or fish instead', co2Kg: 1.5, savingKg: 5.0, savingPct: 77 },
      { action: 'Tofu or paneer curry',    co2Kg: 0.5, savingKg: 6.0, savingPct: 92 },
    ],
    analogy: 'A mutton meal generates more CO₂ than charging a smartphone 600 times. Going plant-based for this one meal saves as much as not charging your laptop for 3 months.',
  },
  {
    keywords: ['pizza', 'cheese pizza', 'dominos', "domino's"],
    co2: 1.8, isAnnual: false,
    summary: 'Cheese Pizza (delivery)',
    context: 'Dairy-heavy foods have significant carbon from livestock plus delivery logistics.',
    alternatives: [
      { action: 'Veggie-loaded thin crust pizza',     co2Kg: 1.1, savingKg: 0.7, savingPct: 39 },
      { action: 'Home-made whole-wheat roti + sabzi', co2Kg: 0.35, savingKg: 1.45, savingPct: 81 },
    ],
    analogy: 'Your pizza delivery emits about as much CO₂ as driving an auto-rickshaw 24 km. The packaging alone takes 500 years to decompose.',
  },
  {
    keywords: ['swiggy', 'zomato', 'order food', 'food delivery', 'blinkit'],
    co2: 2.8, isAnnual: false,
    summary: 'Food Delivery Order',
    context: 'Includes food production (~2.4 kg avg), logistics (~0.4 kg), and packaging.',
    alternatives: [
      { action: 'Cook at home with same ingredients',      co2Kg: 1.2, savingKg: 1.6, savingPct: 57 },
      { action: 'Order from a local tiffin/dabba service', co2Kg: 1.5, savingKg: 1.3, savingPct: 46 },
    ],
    analogy: 'Each Swiggy order is roughly equivalent to leaving a 60W bulb on for 65 hours. 1 delivery per day = 1,022 kg CO₂/year.',
  },

  // ── TRANSPORT ─────────────────────────────────────────────────────────────
  {
    keywords: ['flight', 'fly', 'plane', 'delhi to mumbai', 'delhi mumbai', 'air ticket'],
    co2: 294, isAnnual: false,
    summary: 'Delhi → Mumbai Domestic Flight',
    context: 'Domestic flights emit 0.255 kg CO₂/km. Delhi-Mumbai is ~1,150 km.',
    alternatives: [
      { action: 'Rajdhani Express train (Delhi→Mumbai)',  co2Kg: 13.8, savingKg: 280, savingPct: 95 },
      { action: 'Vande Bharat / Shatabdi Express',        co2Kg: 13.8, savingKg: 280, savingPct: 95 },
    ],
    analogy: 'This flight emits the same CO₂ as 14 trees absorb in an entire year, or driving a petrol car 1,530 km — a Delhi-to-Jaipur-and-back trip, twice over.',
  },
  {
    keywords: ['uber', 'ola', 'cab', 'taxi', 'rapido', 'book a cab'],
    co2: 2.9, isAnnual: false,
    summary: 'Cab/Taxi Ride (15 km avg)',
    context: 'Petrol cab: 0.192 kg CO₂/km × 15 km average, single occupancy.',
    alternatives: [
      { action: 'Metro + 1 km walk',                          co2Kg: 0.6, savingKg: 2.3, savingPct: 79 },
      { action: 'Shared auto or city bus',                    co2Kg: 0.8, savingKg: 2.1, savingPct: 72 },
    ],
    analogy: 'A single 15 km cab ride emits as much CO₂ as 3 hours of streaming Netflix in 4K. Taking the metro instead saves you ₹150 AND the equivalent of 2 days of your phone\'s charging emissions.',
  },
  {
    keywords: ['petrol', 'refuel', 'fill tank', 'fuel', 'petrol pump'],
    co2: 54, isAnnual: false,
    summary: 'Full Petrol Tank (40 litres)',
    context: '40 litres of petrol × 2.31 kg CO₂/litre = ~92 kg, adjusted for engine efficiency.',
    alternatives: [
      { action: 'Go electric — EV charged on India grid', co2Kg: 18, savingKg: 36, savingPct: 67 },
      { action: 'CNG vehicle for same distance',          co2Kg: 32, savingKg: 22, savingPct: 41 },
    ],
    analogy: 'One full petrol tank emits as much CO₂ as 2.5 trees absorb in a full year. That same CO₂ would take 6 months to offset by switching your daily commute to metro.',
  },

  // ── SHOPPING ─────────────────────────────────────────────────────────────
  {
    keywords: ['new phone', 'buy iphone', 'smartphone', 'new mobile', 'new phone'],
    co2: 70, isAnnual: false,
    summary: 'New Smartphone Purchase',
    context: 'Manufacturing a new smartphone emits ~70 kg CO₂ (supply chain, mining, assembly).',
    alternatives: [
      { action: 'Refurbished phone (same specs, 70% less CO₂)', co2Kg: 21, savingKg: 49, savingPct: 70 },
      { action: 'Repair current phone screen/battery',          co2Kg: 5,  savingKg: 65, savingPct: 93 },
    ],
    analogy: 'Your new smartphone\'s manufacturing footprint equals what 3 trees absorb in a year. Choosing refurbished instead saves as much CO₂ as not driving your scooter for 6 months.',
  },
  {
    keywords: ['laptop', 'new laptop', 'buy laptop', 'macbook'],
    co2: 350, isAnnual: false,
    summary: 'New Laptop Purchase',
    context: 'Laptop manufacturing: ~350 kg CO₂ for raw materials, supply chain, and assembly.',
    alternatives: [
      { action: 'Refurbished laptop (Cashify, Flipkart 2GUD)', co2Kg: 105, savingKg: 245, savingPct: 70 },
      { action: 'Repair/upgrade RAM or SSD in current laptop', co2Kg: 15,  savingKg: 335, savingPct: 96 },
    ],
    analogy: 'Your new laptop emits as much CO₂ as taking 1.2 Delhi-Mumbai flights, or 17 trees working for an entire year. Keep your current device one more year — that one choice matters enormously.',
  },
  {
    keywords: ['t-shirt', 'shirt', 'clothes', 'myntra', 'fashion', 'clothing', 'kurta', 'jeans'],
    co2: 10, isAnnual: false,
    summary: 'New Fast Fashion Garment',
    context: '~10 kg CO₂ per garment: cotton farming, dyeing, manufacturing, shipping.',
    alternatives: [
      { action: 'Second-hand or thrifted clothing',    co2Kg: 1.5, savingKg: 8.5, savingPct: 85 },
      { action: 'Rent clothing for an occasion',       co2Kg: 0.5, savingKg: 9.5, savingPct: 95 },
    ],
    analogy: 'One new T-shirt = driving a scooter 97 km. If you buy 3 garments/month, that\'s 360 kg CO₂/year — the same as 17 Delhi-to-Agra drives.',
  },

  // ── ENERGY ────────────────────────────────────────────────────────────────
  {
    keywords: ['ac', 'air conditioner', 'aircon', 'run ac', 'turn on ac'],
    co2: 8.5, isAnnual: false,
    summary: 'AC All Night (8 hrs, 1.5 Ton)',
    context: '1.5 kW × 8 hrs = 12 kWh × 0.708 kg CO₂/kWh (India grid) = 8.5 kg.',
    alternatives: [
      { action: 'Fan + open windows (night breeze)', co2Kg: 0.4, savingKg: 8.1, savingPct: 95 },
      { action: 'AC at 26°C instead of 18°C (saves ~24%)', co2Kg: 6.5, savingKg: 2.0, savingPct: 24 },
    ],
    analogy: 'Running AC all night emits as much CO₂ as charging your phone 340 times. India\'s Bureau of Energy Efficiency says each 1°C raise in AC setpoint saves 6% electricity — setting it to 26°C is the same as not having AC 1 night per week.',
  },
  {
    keywords: ['geyser', 'water heater', 'hot shower', 'electric shower'],
    co2: 2.8, isAnnual: false,
    summary: 'Electric Geyser (2 hrs)',
    context: '2 kW × 2 hrs = 4 kWh × 0.708 kg CO₂/kWh = 2.83 kg CO₂.',
    alternatives: [
      { action: 'Solar water heater (rooftop)',          co2Kg: 0.1, savingKg: 2.7, savingPct: 96 },
      { action: 'Heat water with gas for 10 min shower', co2Kg: 0.9, savingKg: 1.9, savingPct: 68 },
    ],
    analogy: 'Your daily electric shower emits as much CO₂ as streaming YouTube in HD for 78 hours. A solar water heater pays itself back in 2 years and saves ~1 tonne CO₂/year.',
  },

  // ── DIGITAL ───────────────────────────────────────────────────────────────
  {
    keywords: ['netflix', 'stream', 'youtube', 'hotstar', 'watch', 'video'],
    co2: 0.036, isAnnual: false,
    summary: 'Video Streaming (1 hr, HD)',
    context: '1 hr HD streaming ≈ 0.036 kg CO₂ (data center + network energy).',
    alternatives: [
      { action: 'Watch in SD (360p–480p) — 50% less CO₂', co2Kg: 0.018, savingKg: 0.018, savingPct: 50 },
      { action: 'Download content on WiFi and watch offline', co2Kg: 0.005, savingKg: 0.031, savingPct: 86 },
    ],
    analogy: '1 year of 4K Netflix = driving a scooter 50 km. Seems small — but across India\'s 100M+ OTT subscribers, streaming is a serious issue.',
  },
  {
    keywords: ['crypto', 'bitcoin', 'nft', 'blockchain'],
    co2: 250, isAnnual: false,
    summary: 'Bitcoin Transaction (1 BTC)',
    context: 'One Bitcoin transaction consumes ~1,700 kWh — equivalent to 60 days of Indian household electricity.',
    alternatives: [
      { action: 'Use Ethereum (post-merge, 99.9% less energy)', co2Kg: 0.003, savingKg: 249.997, savingPct: 99 },
      { action: 'UPI/bank transfer (near zero energy)',          co2Kg: 0.001, savingKg: 249.999, savingPct: 99 },
    ],
    analogy: 'One Bitcoin transaction emits as much CO₂ as 12 full Delhi-Mumbai flights. The entire Bitcoin network uses more electricity than Pakistan annually.',
  },
];

/**
 * Find the best matching rule for a given input.
 * @param {string} text - Lowercased input
 * @returns {NudgeResult|null}
 */
function findBestRule(text) {
  let bestRule = null;
  let bestScore = 0;

  for (const rule of RULE_PATTERNS) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) score += kw.length; // longer matches score higher
    }
    if (score > bestScore) {
      bestScore = score;
      bestRule  = rule;
    }
  }

  if (!bestRule) return null;

  return {
    estimatedCO2Kg: bestRule.co2,
    isAnnual:       bestRule.isAnnual,
    actionSummary:  bestRule.summary,
    context:        bestRule.context,
    alternatives:   bestRule.alternatives,
    analogy:        bestRule.analogy,
    source:         'rules',
  };
}

// ─── MAIN ANALYZE FUNCTION ───────────────────────────────────────────────────

/**
 * Analyze an action's carbon impact using Gemini or rule-based fallback.
 * @param {string} userAction
 * @param {{ useAI: boolean }} options
 * @returns {Promise<NudgeResult>}
 */
export async function analyzeAction(userAction, options = {}) {
  const { useAI = true } = options;

  // Sanitize first
  const sanitized = sanitizeInput(userAction);
  if (!sanitized || sanitized.length < 3) {
    throw new Error('Please describe an action to analyze.');
  }

  if (useAI && hasApiKey()) {
    try {
      return await analyzeWithGemini(sanitized);
    } catch (err) {
      console.warn('[CarbonMirror] Gemini API failed, using rule-based fallback:', err.message);
      // Fall through to rules
    }
  }

  return analyzeWithRules(sanitized);
}

// ─── SECURITY: INPUT/OUTPUT SANITIZATION ─────────────────────────────────────

/**
 * Sanitize user input against XSS and injection.
 * @param {string} input
 * @returns {string}
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\n{3,}/g, '\n\n')   // collapse excessive newlines
    .trim()
    .slice(0, 500);                // hard limit
}

/**
 * Sanitize output text from API.
 * @param {string} text
 * @returns {string}
 */
function sanitizeOutput(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')       // strip any HTML tags
    .replace(/[<>]/g, '')          // strip residual angle brackets
    .trim()
    .slice(0, 400);
}

/**
 * @typedef {Object} NudgeResult
 * @property {number}   estimatedCO2Kg  - CO₂ for this action
 * @property {boolean}  isAnnual        - Whether CO₂ is an annual figure
 * @property {string}   actionSummary   - Short label for the action
 * @property {string}   context         - Explanation of the estimate
 * @property {Array}    alternatives    - [{action, co2Kg, savingKg, savingPct}]
 * @property {string}   analogy         - Emotional analogy
 * @property {'gemini'|'rules'} source  - Which engine produced the result
 */
