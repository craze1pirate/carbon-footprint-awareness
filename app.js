/**
 * app.js
 * CarbonMirror — Core Application Entry Point
 * ES Module. Wires all modules, manages navigation, handles UI events.
 */

// ─── MODULE IMPORTS ───────────────────────────────────────────────────────────
import {
  calculateTransport, calculateFood, calculateEnergy,
  calculateShopping, calculateDigital, getTotal,
  generateRoadmap, formatKg, getTier,
} from './calculator.js';

import {
  initPlanet, updatePlanet, toggleRotation, resetView,
} from './visualization.js';

import {
  analyzeAction, saveApiKey, clearApiKey, hasApiKey, getMaskedKey, sanitizeInput,
} from './nudge-engine.js';

import {
  loadState, joinChallenge, dailyCheckIn,
  abandonChallenge, checkBadges, markCalculatorComplete,
  markShared, getLeaderboard, getBestStreak, getActiveChallengeCount,
  getStreakEmoji, getStreakDots, isStreakBroken,
  CHALLENGES, BADGES,
} from './gamification.js';

import {
  downloadCard, nativeShare, generateShareText, generateShareCard,
} from './share.js';

/**
 * AppState Singleton representing the runtime state of the application.
 * @type {Object}
 */
const AppState = {
  currentSection: 'home',
  calculatorInputs: {},
  results: null,         // { totalKg, tier, tierInfo, breakdown, analogies, percentages }
  gamification: loadState(),  // persisted gamification state
  planetInitialized: false,
};

// Expose navigation for inline onclick handlers in the SPA
window.CarbonMirror = { navigate };

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
const SECTIONS = ['home', 'calculator', 'dashboard', 'nudge', 'challenges', 'roadmap'];

/**
 * Handles seamless SPA hash-based section routing with transitions.
 * @param {string} sectionId - The ID of the target section.
 */
function navigate(sectionId) {
  if (!SECTIONS.includes(sectionId)) return;

  // Hide current
  const prev = document.getElementById(`section-${AppState.currentSection}`);
  if (prev) {
    prev.classList.remove('active');
    setTimeout(() => { if (!prev.classList.contains('active')) prev.style.display = 'none'; }, 400);
  }

  // Show new
  const next = document.getElementById(`section-${sectionId}`);
  if (next) {
    next.style.display = 'block';
    void next.offsetWidth; // Trigger reflow for CSS animations
    next.classList.add('active');
  }

  // Update nav links
  document.querySelectorAll('.nav__link').forEach(link => {
    link.classList.toggle('active', link.dataset.section === sectionId);
    link.setAttribute('aria-current', link.dataset.section === sectionId ? 'page' : 'false');
  });

  AppState.currentSection = sectionId;
  window.location.hash = sectionId;

  // Section-specific init
  if (sectionId === 'dashboard' && !AppState.planetInitialized) {
    initPlanetSection();
  }
  if (sectionId === 'dashboard') {
    refreshDashboard();
  }
  if (sectionId === 'challenges') {
    renderChallenges();
    renderBadges();
    renderLeaderboard();
    renderPointsSummary();
  }
  if (sectionId === 'roadmap') {
    renderRoadmap();
    renderShareSection();
  }

  // Close mobile nav
  const navLinks = document.getElementById('nav-links');
  if (navLinks?.classList.contains('open')) {
    navLinks.classList.remove('open');
    document.getElementById('nav-hamburger')?.setAttribute('aria-expanded', 'false');
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Bootstraps initial route on application load using the location hash.
 */
function initRouting() {
  const hash = window.location.hash.replace('#', '') || 'home';
  const section = SECTIONS.includes(hash) ? hash : 'home';
  if (section !== 'home') {
    setTimeout(() => navigate(section), 100);
  }
}

// ─── CALCULATOR WIRING ───────────────────────────────────────────────────────

/**
 * Wires range inputs, event listeners, and live display elements for the carbon calculator.
 */
function initCalculator() {
  // Tab switching
  document.querySelectorAll('.calc-tab').forEach(tab => {
    tab.addEventListener('click', () => switchCalcTab(tab.dataset.tab));
    tab.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchCalcTab(tab.dataset.tab); }
    });
  });

  // Range inputs → live display
  const rangeInputs = [
    ['transport-km-week', 'transport-km-display', v => `${v} km`],
    ['transport-public-km', 'transport-public-km-display', v => `${v} km`],
    ['transport-flights', 'transport-flights-display', v => `${v} flight${v != 1 ? 's' : ''}`],
    ['food-chicken-week', 'food-chicken-display', v => `${v} serving${v != 1 ? 's' : ''}`],
    ['food-red-meat-week', 'food-red-meat-display', v => `${v} serving${v != 1 ? 's' : ''}`],
    ['food-eggs-week', 'food-eggs-display', v => `${v} egg${v != 1 ? 's' : ''}`],
    ['food-delivery-week', 'food-delivery-display', v => `${v} order${v != 1 ? 's' : ''}`],
    ['energy-electricity-kwh', 'energy-electricity-display', v => `${v} kWh`],
    ['energy-lpg-cylinders', 'energy-lpg-display', v => `${v} cyl`],
    ['energy-ac-hrs', 'energy-ac-display', v => `${v} hrs`],
    ['energy-ac-months', 'energy-ac-months-display', v => `${v} month${v != 1 ? 's' : ''}`],
    ['shopping-new-clothes', 'shopping-clothes-display', v => `${v} item${v != 1 ? 's' : ''}`],
    ['shopping-smartphones', 'shopping-phones-display', v => `${v} phone${v != 1 ? 's' : ''}`],
    ['shopping-laptops', 'shopping-laptops-display', v => `${v} laptop${v != 1 ? 's' : ''}`],
    ['shopping-online-orders', 'shopping-orders-display', v => `${v} order${v != 1 ? 's' : ''}`],
    ['shopping-large-appliances', 'shopping-appliances-display', v => `${v} item${v != 1 ? 's' : ''}`],
    ['digital-streaming-hrs', 'digital-streaming-display', v => `${v} hrs`],
    ['digital-social-hrs', 'digital-social-display', v => `${v} hrs`],
    ['digital-video-calls-hrs', 'digital-calls-display', v => `${v} hr${v != 1 ? 's' : ''}`],
    ['digital-gaming-hrs', 'digital-gaming-display', v => `${v} hrs`],
  ];

  rangeInputs.forEach(([inputId, displayId, formatter]) => {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    if (!input || !display) return;

    const update = () => {
      display.textContent = formatter(input.value);
      updateProgress();
    };
    input.addEventListener('input', update);
    update();
  });

  // Vehicle select → show/hide km group
  const vehicleSelect = document.getElementById('transport-vehicle');
  const vehicleKmGroup = document.getElementById('vehicle-km-group');
  if (vehicleSelect && vehicleKmGroup) {
    const toggleVehicleKm = () => {
      vehicleKmGroup.style.display = vehicleSelect.value === 'none' ? 'none' : 'flex';
    };
    vehicleSelect.addEventListener('change', toggleVehicleKm);
    toggleVehicleKm(); // Runs on page load to hide distance initially
  }

  // Toggle flight distance group based on flight count
  const flightInput = document.getElementById('transport-flights');
  const flightDistGroup = document.getElementById('transport-flight-distance')?.parentElement;
  if (flightInput && flightDistGroup) {
    const toggleFlightDist = () => {
      flightDistGroup.style.display = Number(flightInput.value) === 0 ? 'none' : 'flex';
    };
    flightInput.addEventListener('input', toggleFlightDist);
    toggleFlightDist(); // Runs on page load to hide distance initially
  }

  // Toggle public transit distance and mode groups based on usage selection
  const publicDaysSelect = document.getElementById('transport-public-days');
  const publicKmGroup = document.getElementById('transport-public-km')?.parentElement;
  const publicTypeGroup = document.getElementById('transport-public-type')?.parentElement;
  if (publicDaysSelect && publicKmGroup && publicTypeGroup) {
    const togglePublicTransit = () => {
      const hasTransit = publicDaysSelect.value !== '0';
      publicKmGroup.style.display = hasTransit ? 'flex' : 'none';
      publicTypeGroup.style.display = hasTransit ? 'flex' : 'none';
    };
    publicDaysSelect.addEventListener('change', togglePublicTransit);
    togglePublicTransit(); // Runs on page load to hide transit initially
  }

  // Calculate button
  const calcBtn = document.getElementById('calculate-btn');
  if (calcBtn) calcBtn.addEventListener('click', runCalculation);

  // Update progress on any change
  document.querySelectorAll('.calc-panel input, .calc-panel select').forEach(el => {
    el.addEventListener('change', updateProgress);
  });
}

/**
 * Handles toggling between panels in the calculator wizard.
 * @param {string} tabId - Target tab identifier.
 */
function switchCalcTab(tabId) {
  document.querySelectorAll('.calc-tab').forEach(tab => {
    const isActive = tab.dataset.tab === tabId;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('.calc-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `calc-panel-${tabId}`);
  });
  updateProgress();
}

/**
 * Dynamically updates the percentage and text of the progress bar based on user interaction.
 */
function updateProgress() {
  const activeTab = document.querySelector('.calc-tab.active');
  const tabs = ['transport', 'food', 'energy', 'shopping', 'digital'];
  const activeIndex = tabs.indexOf(activeTab?.dataset.tab ?? 'transport');
  const pct = Math.round(((activeIndex + 1) / tabs.length) * 100);

  const fill = document.getElementById('calc-progress-fill');
  const text = document.getElementById('calc-progress-text');
  if (fill) { fill.style.width = `${pct}%`; fill.parentElement.setAttribute('aria-valuenow', pct); }
  if (text) text.textContent = `${tabs[activeIndex] ? capitalize(tabs[activeIndex]) : 'Transport'} tab — ${pct}% done`;
}

/**
 * Gathers user values from all form inputs and structures them.
 * @returns {Object} Structured user emission inputs.
 */
function gatherInputs() {
  const g = (id) => document.getElementById(id);
  const v = (id) => g(id)?.value ?? '';
  const n = (id) => Number(v(id)) || 0;

  return {
    transport: {
      vehicle: v('transport-vehicle'),
      kmPerWeek: n('transport-km-week'),
      publicDays: v('transport-public-days'),
      publicKmDay: n('transport-public-km'),
      publicType: v('transport-public-type'),
      flights: n('transport-flights'),
      flightKm: n('transport-flight-distance'),
    },
    food: {
      dietType: v('food-diet-type'),
      chickenPerWeek: n('food-chicken-week'),
      redMeatPerWeek: n('food-red-meat-week'),
      dairyLitresDay: n('food-dairy-litres'),
      eggsPerWeek: n('food-eggs-week'),
      deliveryPerWeek: n('food-delivery-week'),
      wasteMultiplier: n('food-waste'),
    },
    energy: {
      electricityKwh: n('energy-electricity-kwh'),
      lpgCylinders: n('energy-lpg-cylinders'),
      cookingType: v('energy-cooking-type'),
      acHrsDay: n('energy-ac-hrs'),
      acMonths: n('energy-ac-months'),
      solarLevel: v('energy-solar'),
    },
    shopping: {
      newClothesMonth: n('shopping-new-clothes'),
      smartphonesYear: n('shopping-smartphones'),
      laptopsYear: n('shopping-laptops'),
      onlineOrdersWeek: n('shopping-online-orders'),
      largeAppliancesYear: n('shopping-large-appliances'),
    },
    digital: {
      streamingHrsDay: n('digital-streaming-hrs'),
      streamingQuality: v('digital-streaming-quality'),
      socialHrsDay: n('digital-social-hrs'),
      videoCallHrsDay: n('digital-video-calls-hrs'),
      cloudGb: n('digital-cloud-gb'),
      gamingHrsDay: n('digital-gaming-hrs'),
    },
  };
}

/**
 * Runs the main carbon calculations across categories and updates gamification state.
 */
function runCalculation() {
  const inputs = gatherInputs();
  AppState.calculatorInputs = inputs;

  const transport = calculateTransport(inputs.transport);
  const food = calculateFood(inputs.food);
  const energy = calculateEnergy(inputs.energy);
  const shopping = calculateShopping(inputs.shopping);
  const digital = calculateDigital(inputs.digital);

  const results = getTotal({ transport, food, energy, shopping, digital });
  results.categoryResults = { transport, food, energy, shopping, digital };
  AppState.results = results;

  // Update gamification
  AppState.gamification = markCalculatorComplete(AppState.gamification, results.totalKg);
  renderResults(results);

  // Animate to result
  setTimeout(() => {
    document.getElementById('calc-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);

  showToast(`✨ Calculation complete! You emit ${formatKg(results.totalKg)} kg CO₂/year`, 'success');
}

/**
 * Render the results of the calculation on the page.
 * @param {Object} results - Calculation output results object.
 */
function renderResults(results) {
  const { totalKg, tierInfo, percentages } = results;

  // Show results card
  const resultsEl = document.getElementById('calc-results');
  if (resultsEl) resultsEl.classList.remove('hidden');

  // Animate number
  const kgEl = document.getElementById('result-kg-value');
  if (kgEl) animateNumber(kgEl, 0, totalKg, 1200);

  // Tier badge
  const tierBadge = document.getElementById('result-tier-badge');
  const tierDesc = document.getElementById('result-tier-desc');
  if (tierBadge) tierBadge.textContent = `${tierInfo.icon} ${tierInfo.label}`;
  if (tierDesc) tierDesc.textContent = tierInfo.description ?? '';

  // Apply tier CSS class to body for dynamic color theming
  document.body.classList.remove('tier--green', 'tier--yellow', 'tier--orange', 'tier--red');
  document.body.classList.add(tierInfo.cssClass);

  // Breakdown bars
  const barsEl = document.getElementById('breakdown-bars');
  if (barsEl) {
    barsEl.innerHTML = percentages.map(item => `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${item.icon}</span>
          <span>${item.label}</span>
        </div>
        <div class="breakdown-track" role="progressbar" aria-valuenow="${item.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${item.label}: ${item.pct}%">
          <div class="breakdown-fill" style="width:0%; background:${getCategoryColor(item.label)}" data-width="${item.pct}%"></div>
        </div>
        <div class="breakdown-value">${formatKg(item.kg)} kg</div>
      </div>
    `).join('');

    // Animate bars after paint
    requestAnimationFrame(() => {
      barsEl.querySelectorAll('.breakdown-fill').forEach(el => {
        const w = el.dataset.width;
        setTimeout(() => el.style.width = w, 100);
      });
    });
  }

  // Update planet if dashboard is open
  if (AppState.planetInitialized) updatePlanet(totalKg);
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

/**
 * Initializes Three.js (or fallback) rendering environment on the dashboard.
 */
async function initPlanetSection() {
  const canvas = document.getElementById('planet-canvas');
  if (!canvas) return;
  await initPlanet(canvas);
  AppState.planetInitialized = true;

  if (AppState.results) updatePlanet(AppState.results.totalKg);

  // Controls
  document.getElementById('planet-rotate-btn')?.addEventListener('click', () => {
    const rotating = toggleRotation();
    const btn = document.getElementById('planet-rotate-btn');
    if (btn) btn.textContent = rotating ? '🔄 Auto-Rotate' : '⏸ Paused';
  });

  document.getElementById('planet-reset-btn')?.addEventListener('click', resetView);
}

/**
 * Refreshes the dashboard tab to render calculations, visual effects, and analogies.
 */
function refreshDashboard() {
  const results = AppState.results;
  if (!results) return;

  const { totalKg, tierInfo, analogies, percentages } = results;

  // Tier banner
  const tierBanner = document.getElementById('dashboard-tier-badge');
  if (tierBanner) tierBanner.textContent = `${tierInfo.icon} ${tierInfo.label} — ${formatKg(totalKg)} kg CO₂/yr`;

  // Analogy label
  const kgLabel = document.getElementById('analogy-kg-label');
  if (kgLabel) kgLabel.textContent = `${formatKg(totalKg)} kg CO₂`;

  // Analogies
  setTextContent('analogy-drives', `${analogies.delhiMumbaiDrives}×`);
  setTextContent('analogy-trees', `${analogies.treesNeeded.toLocaleString('en-IN')} trees`);
  setTextContent('analogy-electricity', `${analogies.electricityMonths} months`);
  setTextContent('analogy-flights', `${analogies.domesticFlights}×`);
  setTextContent('analogy-india-compare', analogies.vsIndiaAvgLabel);

  // Update planet
  if (AppState.planetInitialized) updatePlanet(totalKg);

  // Breakdown bars
  const dbEl = document.getElementById('dashboard-breakdown');
  if (dbEl) {
    dbEl.innerHTML = percentages.map(item => `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${item.icon}</span>
          <span>${item.label}</span>
        </div>
        <div class="breakdown-track" role="progressbar" aria-valuenow="${item.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${item.label}: ${item.pct}%">
          <div class="breakdown-fill" style="width:0%; background:${getCategoryColor(item.label)}" data-width="${item.pct}%"></div>
        </div>
        <div class="breakdown-value">${formatKg(item.kg)} kg (${item.pct}%)</div>
      </div>
    `).join('');

    requestAnimationFrame(() => {
      dbEl.querySelectorAll('.breakdown-fill').forEach(el => {
        setTimeout(() => el.style.width = el.dataset.width, 100);
      });
    });
  }
}

// ─── NUDGE ENGINE UI ─────────────────────────────────────────────────────────

/**
 * Configures event listeners, mode toggles, and examples for the AI nudge engine.
 */
function initNudge() {
  const toggle = document.getElementById('nudge-ai-toggle');
  const modeLabel = document.getElementById('nudge-mode-label');
  toggle?.addEventListener('change', () => {
    const aiOn = toggle.checked;
    if (modeLabel) modeLabel.textContent = aiOn ? '✨ Gemini AI Mode' : '⚡ Rule-Based Mode';
  });

  // Example chips
  document.querySelectorAll('.nudge-example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const input = document.getElementById('nudge-input');
      if (input) {
        input.value = chip.dataset.query;
        input.focus();
      }
    });
  });

  // Scan button
  document.getElementById('nudge-scan-btn')?.addEventListener('click', runNudgeScan);
  document.getElementById('nudge-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runNudgeScan(); }
  });
}

/**
 * Triggers the carbon nudge analysis of the user's input and updates UI loading states.
 */
async function runNudgeScan() {
  const input = document.getElementById('nudge-input');
  const query = input?.value?.trim();
  if (!query || query.length < 3) {
    showToast('Please describe an action to scan.', 'error');
    return;
  }

  const aiToggle = document.getElementById('nudge-ai-toggle');
  const useAI = aiToggle?.checked ?? true;

  setNudgeLoading(true);

  try {
    const result = await analyzeAction(query, { useAI });
    renderNudgeResult(result, query);
    if (result.source === 'rules') {
      showToast('⚡ Used rule-based analysis (add Gemini key for AI insights)', 'info');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
    setNudgeLoading(false);
  }
}

/**
 * Renders loading indicators when the nudge API is calculating emissions.
 * @param {boolean} loading - Loading state active flag.
 */
function setNudgeLoading(loading) {
  const loadingEl = document.getElementById('nudge-loading');
  const scanBtn = document.getElementById('nudge-scan-btn');
  const btnText = document.getElementById('nudge-btn-text');
  const resultEl = document.getElementById('nudge-result');

  if (loading) {
    loadingEl?.classList.add('visible');
    resultEl?.classList.remove('visible');
    if (scanBtn) scanBtn.disabled = true;
    if (btnText) btnText.textContent = '⏳ Scanning…';
  } else {
    loadingEl?.classList.remove('visible');
    if (scanBtn) scanBtn.disabled = false;
    if (btnText) btnText.textContent = '🔍 Scan';
  }
}

/**
 * Renders the returned result (alternatives and emotional analogy) of a nudge scan.
 * @param {Object} result - Nudge engine output results object.
 * @param {string} originalQuery - The raw query submitted.
 */
function renderNudgeResult(result, originalQuery) {
  setNudgeLoading(false);

  const co2Badge = document.getElementById('nudge-co2-badge');
  const co2Value = document.getElementById('nudge-co2-value');
  const actionLabel = document.getElementById('nudge-action-label');
  const actionCtx = document.getElementById('nudge-action-context');
  const altsEl = document.getElementById('nudge-alternatives');
  const analogyEl = document.getElementById('nudge-analogy');
  const resultEl = document.getElementById('nudge-result');

  if (co2Value) co2Value.textContent = result.estimatedCO2Kg.toFixed(1);
  if (actionLabel) actionLabel.textContent = result.actionSummary;
  if (actionCtx) actionCtx.textContent = result.context;

  // Color badge by severity
  const severity = result.estimatedCO2Kg > 50 ? 'high' : result.estimatedCO2Kg > 5 ? 'medium' : 'low';
  const badgeColors = {
    high: 'rgba(192,57,43,0.12)',
    medium: 'rgba(230,126,34,0.12)',
    low: 'rgba(39,174,96,0.12)',
  };
  const badgeBorders = { high: 'var(--color-red-tier)', medium: 'var(--color-orange-tier)', low: 'var(--color-green-tier)' };
  if (co2Badge) {
    co2Badge.style.background = badgeColors[severity];
    co2Badge.style.borderColor = badgeBorders[severity];
    co2Badge.style.setProperty('--badge-color', badgeBorders[severity]);
  }

  // Alternatives
  if (altsEl) {
    altsEl.innerHTML = result.alternatives.map(alt => `
      <div class="nudge-alt-card">
        <div class="nudge-alt-saving">🌱 Save ${alt.savingPct}%</div>
        <p style="font-weight:600; font-size:var(--text-sm); color:var(--color-forest-dark); margin-bottom:var(--space-1);">${escapeHtml(alt.action)}</p>
        <p style="font-size:var(--text-xs); color:var(--color-grey-500);">${alt.co2Kg.toFixed(1)} kg CO₂ instead of ${result.estimatedCO2Kg.toFixed(1)} kg</p>
        <p style="font-size:var(--text-xs); color:var(--color-green-tier); font-weight:600;">↓ ${alt.savingKg.toFixed(1)} kg saved</p>
      </div>
    `).join('');
  }

  // Analogy
  if (analogyEl) analogyEl.textContent = `💡 ${result.analogy}`;

  resultEl?.classList.add('visible');
}

// ─── GAMIFICATION UI ─────────────────────────────────────────────────────────

/**
 * Updates the streak display, completed challenge counts, and total points in the UI.
 */
function renderPointsSummary() {
  const gs = AppState.gamification;
  const points = gs.totalPoints || 0;
  const active = getActiveChallengeCount(gs);
  const best = getBestStreak(gs);

  setTextContent('total-points-display', points.toLocaleString('en-IN'));
  setTextContent('challenges-completed-display', active);
  setTextContent('best-streak-display', `${best}${getStreakEmoji(best)}`);
}

/**
 * Dynamically renders challenge grid cards indicating active, locked, or completed challenges.
 */
function renderChallenges() {
  const gs = AppState.gamification;
  const grid = document.getElementById('challenges-grid');
  if (!grid) return;

  grid.innerHTML = CHALLENGES.map(ch => {
    const cs = gs.challenges?.[ch.id] ?? {};
    const streak = cs.streak ?? 0;
    const active = cs.active ?? false;
    const completed = cs.completed ?? false;
    const broken = active && isStreakBroken(cs.lastCheckIn);
    const dots = getStreakDots(streak, ch.duration);
    const streakEmoji = getStreakEmoji(streak);
    const lastCI = cs.lastCheckIn;
    const today = new Date().toISOString().split('T')[0];
    const checkedIn = lastCI === today;

    const statusClass = completed ? 'completed' : active ? 'active' : '';

    return `
      <div class="challenge-card ${statusClass}" id="challenge-card-${ch.id}">
        <div class="challenge-header">
          <div class="challenge-icon" aria-hidden="true">${ch.icon}</div>
          <div class="challenge-meta">
            <div class="challenge-name">${ch.name}</div>
            <div class="challenge-duration">📅 ${ch.duration}-day challenge</div>
          </div>
          <div class="challenge-points">⭐ ${ch.points} pts</div>
        </div>

        <p class="challenge-description">${ch.description}</p>

        ${active ? `
          <div class="challenge-streak">
            <span style="font-size:1.3rem; ${streak >= 3 ? 'animation:streakFire 1s ease infinite;' : ''}">${streakEmoji}</span>
            <span>Day <span class="challenge-streak-value">${streak}</span>/${ch.duration}</span>
            ${broken ? '<span style="color:var(--color-red-tier); font-size:var(--text-xs);">⚠️ Streak at risk!</span>' : ''}
          </div>
          <div class="streak-dots" role="progressbar" aria-valuenow="${streak}" aria-valuemin="0" aria-valuemax="${ch.duration}" aria-label="Streak progress: ${streak} of ${ch.duration} days">
            ${dots.map(d => `<div class="streak-dot ${d === 'filled' ? 'filled' : d === 'fire' ? 'fire' : ''}" aria-hidden="true"></div>`).join('')}
          </div>
          <div style="display:flex; gap:var(--space-2); margin-top:var(--space-4);">
            <button class="btn btn--primary" style="flex:1;" onclick="window.CarbonMirror.challengeCheckIn('${ch.id}')"
              ${checkedIn ? 'disabled' : ''} aria-label="${checkedIn ? 'Already checked in today' : 'Daily check-in for ' + ch.name}">
              ${checkedIn ? '✅ Checked In Today' : '✅ Check In Today'}
            </button>
            <button class="btn btn--secondary btn--sm" onclick="window.CarbonMirror.abandonChallenge('${ch.id}')" aria-label="Abandon ${ch.name} challenge">
              ✕
            </button>
          </div>
        ` : completed ? `
          <div style="text-align:center; padding:var(--space-3);">
            <div style="font-size:2rem; margin-bottom:var(--space-2);">🏆</div>
            <p style="font-weight:700; color:var(--color-green-tier);">Challenge Complete!</p>
            <p style="font-size:var(--text-xs); color:var(--color-grey-500);">You saved ~${ch.co2SaveKg} kg CO₂</p>
          </div>
        ` : `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:var(--space-2);">
            <span style="font-size:var(--text-sm); color:var(--color-grey-500);">🌿 Saves ~${ch.co2SaveKg} kg CO₂</span>
            <button class="btn btn--primary btn--sm" onclick="window.CarbonMirror.joinChallenge('${ch.id}')" aria-label="Join ${ch.name} challenge">
              + Join
            </button>
          </div>
        `}
      </div>
    `;
  }).join('');
}

/**
 * Renders badges with unlock/locked styling indications.
 */
function renderBadges() {
  const gs = AppState.gamification;
  const shelf = document.getElementById('badge-shelf');
  if (!shelf) return;

  shelf.innerHTML = BADGES.map(badge => {
    const unlocked = gs.unlockedBadges?.includes(badge.id);
    return `
      <div class="badge ${unlocked ? 'unlocked' : 'locked'}" role="listitem"
        title="${escapeHtml(badge.name)}: ${escapeHtml(badge.description)}"
        aria-label="${badge.name} badge — ${unlocked ? 'Unlocked' : 'Locked'}: ${badge.description}">
        <div class="badge-icon" aria-hidden="true">${badge.icon}</div>
        <div class="badge-name">${badge.name}</div>
        ${unlocked ? '<div style="font-size:var(--text-xs); color:var(--color-gold);">✓ Unlocked</div>' : '<div style="font-size:var(--text-xs); color:var(--color-grey-400);">🔒 Locked</div>'}
      </div>
    `;
  }).join('');
}

/**
 * Renders community leaderboard sorting anonymous entries alongside user's rank.
 */
function renderLeaderboard() {
  const gs = AppState.gamification;
  const board = getLeaderboard(gs, gs.userName || 'You');
  const body = document.getElementById('leaderboard-body');
  if (!body) return;

  const rankStyle = { 1: 'gold', 2: 'silver', 3: 'bronze' };

  body.innerHTML = board.map(entry => {
    const initials = entry.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const rankClass = rankStyle[entry.rank] ?? '';
    const rankEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank;

    return `
      <div class="leaderboard-row ${entry.isUser ? 'is-user' : ''}" role="row"
        aria-label="${escapeHtml(entry.name)}, ${entry.city}, rank ${entry.rank}, ${entry.points} points">
        <div class="leaderboard-rank ${rankClass}" role="cell">${rankEmoji}</div>
        <div class="leaderboard-avatar" aria-hidden="true" style="background: linear-gradient(135deg, ${avatarColor(entry.id)});">
          ${initials}
        </div>
        <div class="leaderboard-info" role="cell">
          <div class="leaderboard-name">${escapeHtml(entry.name)}${entry.isUser ? ' (You)' : ''}</div>
          <div class="leaderboard-city">📍 ${escapeHtml(entry.city)}</div>
        </div>
        <div class="leaderboard-stats" role="cell">
          <div>
            <div class="leaderboard-points">⭐ ${entry.points.toLocaleString('en-IN')}</div>
            <div class="leaderboard-kg">${entry.kg > 0 ? `${Math.round(entry.kg).toLocaleString('en-IN')} kg CO₂` : '—'}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── ROADMAP ──────────────────────────────────────────────────────────────────

/**
 * Renders the personalized 5-step emission-saving roadmap.
 */
function renderRoadmap() {
  const results = AppState.results;
  const stepsEl = document.getElementById('roadmap-steps');
  if (!stepsEl) return;

  if (!results) {
    stepsEl.innerHTML = `
      <div style="text-align:center; padding:var(--space-12); color:var(--color-grey-500);">
        <p>Complete the calculator to unlock your personalized roadmap.</p>
        <button class="btn btn--primary" style="margin-top:var(--space-4);" onclick="window.CarbonMirror.navigate('calculator')">
          🧮 Go to Calculator
        </button>
      </div>
    `;
    return;
  }

  const steps = generateRoadmap(results.categoryResults, results.totalKg);

  stepsEl.innerHTML = steps.map((step, i) => `
    <div class="roadmap-step" aria-label="Step ${step.step}: ${step.title}">
      <div class="roadmap-step-number" aria-hidden="true">${step.step}</div>
      <div class="roadmap-step-content">
        <h3 class="roadmap-step-title">${step.title}</h3>
        <p class="roadmap-step-desc">${step.description}</p>
        <div class="roadmap-savings">
          <span class="savings-chip savings-chip--co2" aria-label="CO2 saving: ${step.savingKg} kg">
            🍃 Save ~${step.savingKg.toLocaleString('en-IN')} kg CO₂/yr
          </span>
          ${step.savingInrMonth > 0 ? `
          <span class="savings-chip savings-chip--inr" aria-label="Money saving: ${step.savingInrMonth} rupees per month">
            💰 Save ~₹${step.savingInrMonth.toLocaleString('en-IN')}/month
          </span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// ─── SHARE UI ─────────────────────────────────────────────────────────────────

/**
 * Configures event listeners, pre-filled fields, and options for card sharing.
 */
function renderShareSection() {
  const results = AppState.results;

  // Update share text preview
  const shareTextEl = document.getElementById('share-text-preview');
  if (shareTextEl && results) {
    const text = generateShareText({
      totalKg: results.totalKg,
      tier: results.tier,
      analogies: results.analogies,
      userName: document.getElementById('share-name-input')?.value || 'A CarbonMirror User',
      pledge: document.getElementById('share-pledge')?.value || '',
    });
    shareTextEl.textContent = text;
  }

  // Generate card button
  document.getElementById('generate-card-btn')?.addEventListener('click', generateAndPreviewCard);
  document.getElementById('download-card-btn')?.addEventListener('click', () => {
    const canvas = document.getElementById('share-canvas');
    if (canvas) downloadCard(canvas);
  });
  document.getElementById('share-native-btn')?.addEventListener('click', handleNativeShare);
  document.getElementById('copy-share-text-btn')?.addEventListener('click', copyShareText);

  // Auto-generate preview if we have results
  if (results) setTimeout(generateAndPreviewCard, 200);
}

/**
 * Generates and draws the social share card layout on an HTML5 canvas.
 */
async function generateAndPreviewCard() {
  const canvas = document.getElementById('share-canvas');
  if (!canvas) return;

  const results = AppState.results;
  if (!results) {
    showToast('Complete the calculator first to generate your card!', 'error');
    return;
  }

  const format = document.getElementById('share-format')?.value ?? 'linkedin';
  const userName = sanitizeInput(document.getElementById('share-name-input')?.value || '');
  const pledge = document.getElementById('share-pledge')?.value || '';

  const data = {
    totalKg: results.totalKg,
    tier: results.tier,
    analogies: results.analogies,
    userName,
    pledge,
  };

  try {
    await generateShareCard(canvas, data, format);

    const shareText = generateShareText(data);
    const preview = document.getElementById('share-text-preview');
    if (preview) preview.textContent = shareText;

    showToast('🎨 Card generated!', 'success');
  } catch (err) {
    showToast('Card generation failed. Try again.', 'error');
  }
}

/**
 * Calls navigator.share sheet to share canvas card image.
 */
async function handleNativeShare() {
  const canvas = document.getElementById('share-canvas');
  const results = AppState.results;
  if (!results || !canvas) { showToast('Generate your card first!', 'error'); return; }

  const shareText = generateShareText({
    totalKg: results.totalKg,
    tier: results.tier,
    analogies: results.analogies,
    userName: document.getElementById('share-name-input')?.value || '',
    pledge: document.getElementById('share-pledge')?.value || '',
  });

  try {
    const result = await nativeShare(canvas, shareText);
    if (result.method !== 'aborted') {
      AppState.gamification = markShared(AppState.gamification);
      showToast('📣 Shared! You earned the Pledge Maker badge!', 'success');
      if (AppState.currentSection === 'challenges') renderBadges();
    }
  } catch (err) {
    showToast('Sharing failed. Try downloading instead.', 'error');
  }
}

/**
 * Copies the pre-filled social share card text to clipboard.
 */
async function copyShareText() {
  const text = document.getElementById('share-text-preview')?.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 Copied to clipboard!', 'success');
  } catch {
    showToast('Could not copy. Please copy manually.', 'error');
  }
}

// ─── API KEY UI ───────────────────────────────────────────────────────────────

/**
 * Wires listeners, saving, clearing, and indicators for the user-supplied Gemini key.
 */
function initApiKeyUI() {
  const input = document.getElementById('api-key-input');
  const saveBtn = document.getElementById('api-key-save-btn');
  const clearBtn = document.getElementById('api-key-clear-btn');
  const statusEl = document.getElementById('api-key-status');

  if (hasApiKey()) {
    if (input) { input.value = ''; input.placeholder = getMaskedKey(); }
    if (saveBtn) saveBtn.classList.add('hidden');
    if (clearBtn) clearBtn.classList.remove('hidden');
    if (statusEl) { statusEl.textContent = '✅ Gemini API key active'; statusEl.style.color = 'var(--color-green-tier)'; }
  }

  saveBtn?.addEventListener('click', () => {
    const key = input?.value?.trim();
    if (!key) { showToast('Please enter an API key.', 'error'); return; }
    if (saveApiKey(key)) {
      if (input) { input.value = ''; input.placeholder = getMaskedKey(); }
      if (saveBtn) saveBtn.classList.add('hidden');
      if (clearBtn) clearBtn.classList.remove('hidden');
      if (statusEl) { statusEl.textContent = '✅ API key saved (session only)'; statusEl.style.color = 'var(--color-green-tier)'; }
      showToast('✨ Gemini API key saved! AI nudges enabled.', 'success');
    } else {
      showToast('Invalid API key format. Gemini keys start with "AIza".', 'error');
    }
  });

  clearBtn?.addEventListener('click', () => {
    clearApiKey();
    if (input) { input.value = ''; input.placeholder = 'AIza… (paste your Gemini API key here)'; }
    if (saveBtn) saveBtn.classList.remove('hidden');
    if (clearBtn) clearBtn.classList.add('hidden');
    if (statusEl) { statusEl.textContent = ''; }
    showToast('API key cleared. Using rule-based mode.', 'info');
  });
}

// ─── GAMIFICATION ACTIONS (exposed to window) ──────────────────────────────
window.CarbonMirror.joinChallenge = (id) => {
  const { state: newState, message } = joinChallenge(id, AppState.gamification);
  AppState.gamification = newState;
  showToast(message, 'success');
  renderChallenges();
  renderBadges();
  renderPointsSummary();
};

window.CarbonMirror.challengeCheckIn = (id) => {
  const { state: newState, message, newBadges, streakBroken } = dailyCheckIn(id, AppState.gamification);
  AppState.gamification = newState;
  showToast(message, streakBroken ? 'error' : 'success');

  if (newBadges.length > 0) {
    newBadges.forEach(badgeId => {
      const badge = BADGES.find(b => b.id === badgeId);
      if (badge) setTimeout(() => showToast(`🏅 New Badge: ${badge.name}! ${badge.icon}`, 'badge'), 500);
    });
  }

  renderChallenges();
  renderBadges();
  renderPointsSummary();
  renderLeaderboard();
};

window.CarbonMirror.abandonChallenge = (id) => {
  AppState.gamification = abandonChallenge(id, AppState.gamification);
  const ch = CHALLENGES.find(c => c.id === id);
  showToast(`${ch?.name || 'Challenge'} abandoned. You can rejoin anytime.`, 'info');
  renderChallenges();
  renderPointsSummary();
};

// ─── NAV ─────────────────────────────────────────────────────────────────────

/**
 * Initializes navbar event listeners, mobile hamburger toggle, and scroll shading.
 */
function initNav() {
  document.querySelectorAll('.nav__link[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigate(link.dataset.section);
    });
  });

  const hamburger = document.getElementById('nav-hamburger');
  const navLinks = document.getElementById('nav-links');
  hamburger?.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(open));
  });

  window.addEventListener('scroll', () => {
    const nav = document.querySelector('.nav');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  document.addEventListener('click', e => {
    if (!e.target.closest('.nav')) {
      navLinks?.classList.remove('open');
      hamburger?.setAttribute('aria-expanded', 'false');
    }
  });
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

/**
 * Spawns an animated, accessible bottom-right toast notification.
 * @param {string} message - Notification text content.
 * @param {string} [type] - Semantic type ('success', 'error', 'info', 'badge').
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️', badge: '🏅' };
  const colors = { success: '#27AE60', error: '#C0392B', info: '#2980B9', badge: '#D4A017' };

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.style.borderLeft = `4px solid ${colors[type] ?? colors.info}`;
  toast.innerHTML = `<span aria-hidden="true">${icons[type] ?? 'ℹ️'}</span><span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, type === 'badge' ? 4000 : 3000);
}

// ─── HERO PARTICLES ──────────────────────────────────────────────────────────

/**
 * Populates floating atmospheric green micro-particles behind the main hero heading.
 */
function initHeroParticles() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const container = document.getElementById('hero-particles');
  if (!container) return;

  container.style.cssText = `
    position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;
  `;

  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    const size = Math.random() * 6 + 3;
    const x = Math.random() * 100;
    const delay = Math.random() * 4;
    const dur = 4 + Math.random() * 4;
    const dx = (Math.random() - 0.5) * 150;
    const dy = -(100 + Math.random() * 200);

    particle.style.cssText = `
      position: absolute;
      width: ${size}px; height: ${size}px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(39,174,96,0.8), rgba(27,67,50,0.3));
      left: ${x}%;
      bottom: -20px;
      --dx: ${dx}px; --dy: ${dy}px;
      animation: particleDrift ${dur}s ease-out ${delay}s infinite;
    `;
    container.appendChild(particle);
  }
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

/**
 * Standardized DOM text utility.
 * @param {string} id - Target DOM element ID.
 * @param {string} text - Desired text content.
 */
function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - Target string.
 * @returns {string} Capitalized output string.
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escapes special HTML characters to prevent XSS injection.
 * @param {string} str - Raw input string.
 * @returns {string} Sanitized safe string.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Returns hex color code assigned to different carbon categories.
 * @param {string} label - Category label.
 * @returns {string} Hex color string.
 */
function getCategoryColor(label) {
  const colors = {
    Transport: '#2980B9',
    Food: '#27AE60',
    'Home Energy': '#E67E22',
    Shopping: '#8E44AD',
    Digital: '#1B4332',
  };
  return colors[label] ?? '#27AE60';
}

/**
 * Generates gradients for leaderboard profile avatars based on ID characters.
 * @param {string} id - Profile ID string.
 * @returns {string} CSS gradient color-stop string.
 */
function avatarColor(id) {
  const colors = [
    '#1B4332, #27AE60', '#0D47A1, #2196F3', '#4A148C, #9C27B0',
    '#BF360C, #FF5722', '#004D40, #009688', '#F57F17, #FFC107',
    '#880E4F, #E91E63', '#1A237E, #3F51B5',
  ];
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

/**
 * Interpolates numbers smoothly with a cubic ease-out algorithm for score animations.
 * @param {HTMLElement} el - Target DOM element.
 * @param {number} from - Starting value.
 * @param {number} to - End value.
 * @param {number} duration - Animation duration in ms.
 */
function animateNumber(el, from, to, duration) {
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────

/**
 * Primary initialization wrapper executing routing, navigation, and particle scripts.
 */
function init() {
  initNav();
  initCalculator();
  initApiKeyUI();
  initNudge();
  initRouting();
  initHeroParticles();

  const homeSection = document.getElementById('section-home');
  if (homeSection) homeSection.style.display = 'flex';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}