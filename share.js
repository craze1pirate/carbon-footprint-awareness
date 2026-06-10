/**
 * share.js
 * CarbonMirror — Canvas 2D Share Card Generator & Social Share
 * Generates LinkedIn (1200×628) and WhatsApp (1080×1080) cards.
 */

// ─── FONT PRELOAD ────────────────────────────────────────────────────────────
// Ensures Outfit is available before Canvas rendering
let fontsLoaded = false;
async function ensureFonts() {
  if (fontsLoaded) return;
  try {
    await document.fonts.load('900 72px Outfit');
    await document.fonts.load('700 32px Outfit');
    await document.fonts.load('400 20px Inter');
    fontsLoaded = true;
  } catch {
    fontsLoaded = true; // proceed anyway with fallback fonts
  }
}

// ─── TIER THEME MAP ──────────────────────────────────────────────────────────
const TIER_THEMES = {
  green: {
    bg:         ['#0D2B20', '#1B4332', '#2D6A4F'],
    accent:     '#27AE60',
    accentLight:'#52BE80',
    tierLabel:  'Carbon Champion',
    icon:       '🌱',
    tagline:    'Significantly below India\'s average. You\'re leading the change.',
  },
  yellow: {
    bg:         ['#2D2206', '#4A3800', '#6B5200'],
    accent:     '#F39C12',
    accentLight:'#F8C471',
    tierLabel:  'Average Citizen',
    icon:       '🌤️',
    tagline:    'Around India\'s average. Small changes make a huge difference.',
  },
  orange: {
    bg:         ['#2D0D00', '#4A2000', '#6B3510'],
    accent:     '#E67E22',
    accentLight:'#F0A060',
    tierLabel:  'Heavy Footprint',
    icon:       '⚠️',
    tagline:    'Above India\'s average. Time to take action.',
  },
  red: {
    bg:         ['#200505', '#3A0A0A', '#5C1515'],
    accent:     '#C0392B',
    accentLight:'#E74C3C',
    tierLabel:  'Climate Emergency',
    icon:       '🔴',
    tagline:    'Urgent action needed. Every change counts.',
  },
};

// ─── PRESET DIMENSIONS ───────────────────────────────────────────────────────
const PRESETS = {
  linkedin:  { width: 1200, height: 628,  label: 'LinkedIn'  },
  whatsapp:  { width: 1080, height: 1080, label: 'WhatsApp'  },
};

// ─── MAIN CARD GENERATOR ─────────────────────────────────────────────────────

/**
 * Generate a share card on the given canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {CardData} data
 * @param {'linkedin'|'whatsapp'} format
 */
export async function generateShareCard(canvas, data, format = 'linkedin') {
  await ensureFonts();

  const preset = PRESETS[format] ?? PRESETS.linkedin;
  canvas.width  = preset.width;
  canvas.height = preset.height;

  const ctx   = canvas.getContext('2d');
  const theme = TIER_THEMES[data.tier] ?? TIER_THEMES.green;
  const W     = preset.width;
  const H     = preset.height;

  // ── BACKGROUND ──
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  theme.bg.forEach((color, i) => bgGrad.addColorStop(i / (theme.bg.length - 1), color));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow top-left
  const glowGrad = ctx.createRadialGradient(W * 0.15, H * 0.15, 0, W * 0.15, H * 0.15, W * 0.6);
  glowGrad.addColorStop(0, hexToRgba(theme.accent, 0.18));
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);

  // Bottom-right secondary glow
  const glow2 = ctx.createRadialGradient(W * 0.85, H * 0.85, 0, W * 0.85, H * 0.85, W * 0.5);
  glow2.addColorStop(0, hexToRgba(theme.accentLight, 0.1));
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Decorative grid lines
  drawGrid(ctx, W, H, theme.accent);

  if (format === 'linkedin') {
    await drawLinkedInLayout(ctx, W, H, theme, data);
  } else {
    await drawWhatsAppLayout(ctx, W, H, theme, data);
  }
}

// ─── LINKEDIN LAYOUT (1200×628) ───────────────────────────────────────────────

async function drawLinkedInLayout(ctx, W, H, theme, data) {
  const pad = 64;

  // ── LOGO top-left ──
  ctx.font = '700 22px Outfit, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('🌍 CarbonMirror', pad, pad);

  // ── Tier badge pill ──
  const tierText = `${theme.icon} ${theme.tierLabel}`;
  const tierX    = pad;
  const tierY    = pad + 36;
  drawPill(ctx, tierX, tierY, tierText, theme.accent, 'rgba(0,0,0,0.4)', 18, 600);

  // ── Separator line left ──
  const lineX = pad + 10;
  const lineY1 = tierY + 48;
  const lineY2 = H - pad;
  ctx.strokeStyle = hexToRgba(theme.accent, 0.4);
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.moveTo(lineX, lineY1 + 20);
  ctx.lineTo(lineX, lineY2);
  ctx.stroke();

  // ── BIG CO₂ NUMBER ──
  const numX = lineX + 40;
  const numY = H * 0.45;

  // "Your Annual Carbon Footprint" label
  ctx.font      = '500 18px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('YOUR ANNUAL CARBON FOOTPRINT', numX, numY - 100);

  // CO₂ number
  const kgFormatted = Math.round(data.totalKg).toLocaleString('en-IN');
  ctx.font      = `900 ${W > 1000 ? 88 : 64}px Outfit, sans-serif`;
  ctx.fillStyle = theme.accentLight;
  ctx.fillText(kgFormatted, numX, numY);

  // Unit
  ctx.font      = '400 28px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('kg CO₂ per year', numX, numY + 44);

  // Tagline
  ctx.font      = '400 20px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(theme.tagline, numX, numY + 90);

  // ── RIGHT SIDE — Analogies ──
  const rightX = W * 0.6;
  const rightY = H * 0.18;

  ctx.font      = '600 18px Outfit, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('THAT\'S EQUIVALENT TO', rightX, rightY);

  const analogies = data.analogies;
  const items = [
    { icon: '🚗', value: `${analogies.delhiMumbaiDrives}×`,     label: 'Delhi→Mumbai drives' },
    { icon: '🌳', value: `${analogies.treesNeeded} trees`,        label: 'needed to offset' },
    { icon: '⚡', value: `${analogies.electricityMonths} months`, label: 'household electricity' },
    { icon: '✈️', value: `${analogies.domesticFlights}×`,         label: 'Delhi→Mumbai flights' },
  ];

  items.forEach((item, i) => {
    const iy = rightY + 32 + i * (format === 'linkedin' ? 100 : 110);
    drawAnalogyRow(ctx, rightX, iy, item.icon, item.value, item.label, theme.accentLight, W - rightX - pad);
  });

  // ── USER NAME ──
  if (data.userName) {
    ctx.font      = '700 20px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(data.userName, pad + 26, H - pad - 40);
  }

  // ── PLEDGE ──
  if (data.pledge) {
    const pledgeY = H - pad - 10;
    ctx.font      = '500 16px Inter, sans-serif';
    ctx.fillStyle = hexToRgba(theme.accentLight, 0.9);
    ctx.fillText(`"${data.pledge}"`, pad + 26, pledgeY);
  }

  // ── PLANET circle decoration (right) ──
  drawPlanetDecoration(ctx, W - pad * 2.5, H * 0.5, Math.min(H * 0.28, 150), theme);

  // ── Branding bottom-right ──
  ctx.font      = '500 14px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'right';
  ctx.fillText('carbomirror.app', W - pad, H - pad + 16);
  ctx.textAlign = 'left';
}

// ─── WHATSAPP LAYOUT (1080×1080) ─────────────────────────────────────────────

async function drawWhatsAppLayout(ctx, W, H, theme, data) {
  const pad = 72;
  const cx  = W / 2;

  // ── LOGO ──
  ctx.font      = '700 24px Outfit, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('🌍 CarbonMirror', cx, pad);

  // ── Planet decoration ──
  drawPlanetDecoration(ctx, cx, H * 0.27, H * 0.14, theme);

  // ── Tier badge ──
  const tierText = `${theme.icon} ${theme.tierLabel}`;
  const tierPillW = measureText(ctx, tierText, '700 20px Outfit') + 48;
  drawPill(ctx, cx - tierPillW / 2, H * 0.42, tierText, theme.accent, 'rgba(0,0,0,0.4)', 20, 700);

  // ── CO₂ number ──
  const kgFormatted = Math.round(data.totalKg).toLocaleString('en-IN');
  ctx.font      = '900 96px Outfit, sans-serif';
  ctx.fillStyle = theme.accentLight;
  ctx.fillText(kgFormatted, cx, H * 0.57);

  ctx.font      = '400 24px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('kg CO₂ per year', cx, H * 0.63);

  // ── Divider ──
  ctx.strokeStyle = hexToRgba(theme.accent, 0.3);
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad * 2, H * 0.67);
  ctx.lineTo(W - pad * 2, H * 0.67);
  ctx.stroke();

  // ── Analogies ──
  const analogies = data.analogies;
  const items = [
    `🚗 ${analogies.delhiMumbaiDrives}× Delhi→Mumbai drives`,
    `🌳 ${analogies.treesNeeded} trees needed to offset`,
    `✈️ ${analogies.domesticFlights}× domestic flights`,
  ];

  ctx.font      = '500 20px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  items.forEach((item, i) => {
    ctx.fillText(item, cx, H * 0.73 + i * 44);
  });

  // ── Pledge ──
  if (data.pledge) {
    ctx.font      = '500 18px Outfit, sans-serif';
    ctx.fillStyle = hexToRgba(theme.accentLight, 0.9);
    wrapText(ctx, `"${data.pledge}"`, cx, H * 0.87, W - pad * 3, 26);
  }

  // ── User name ──
  if (data.userName) {
    ctx.font      = '700 20px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`— ${data.userName}`, cx, H - pad - 10);
  }

  // ── Branding ──
  ctx.font      = '400 14px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('carbomirror.app', cx, H - pad + 20);

  ctx.textAlign = 'left';
}

// ─── DRAWING HELPERS ─────────────────────────────────────────────────────────

function drawGrid(ctx, W, H, accentColor) {
  ctx.save();
  ctx.strokeStyle = hexToRgba(accentColor, 0.05);
  ctx.lineWidth   = 1;

  const spacing = Math.min(W, H) * 0.06;
  for (let x = 0; x < W; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();
}

function drawPill(ctx, x, y, text, bgColor, borderColor, fontSize, fontWeight) {
  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px Outfit, sans-serif`;
  const textW = ctx.measureText(text).width;
  const pH = fontSize * 1.8;
  const pW = textW + fontSize * 2;

  ctx.beginPath();
  ctx.roundRect(x, y, pW, pH, pH / 2);
  ctx.fillStyle   = hexToRgba(bgColor, 0.25);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(bgColor, 0.6);
  ctx.lineWidth   = 2;
  ctx.stroke();

  ctx.fillStyle = 'white';
  ctx.fillText(text, x + fontSize, y + pH * 0.68);
  ctx.restore();
}

function drawAnalogyRow(ctx, x, y, icon, value, label, accentColor, maxWidth) {
  ctx.save();

  // Icon circle
  ctx.font      = '28px serif';
  ctx.fillText(icon, x, y + 28);

  ctx.font      = `700 32px Outfit, sans-serif`;
  ctx.fillStyle = accentColor;
  ctx.fillText(value, x + 44, y + 28);

  const valueW  = ctx.measureText(value).width;
  ctx.font      = '400 18px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(label, x + 44 + valueW + 10, y + 28);

  ctx.restore();
}

function drawPlanetDecoration(ctx, cx, cy, r, theme) {
  ctx.save();

  // Atmosphere glow
  const atmGrad = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.35);
  atmGrad.addColorStop(0, hexToRgba(theme.accent, 0.25));
  atmGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
  ctx.fillStyle = atmGrad;
  ctx.fill();

  // Planet base
  const planetGrad = ctx.createRadialGradient(cx - r*0.25, cy - r*0.25, r*0.05, cx, cy, r);
  planetGrad.addColorStop(0, lightenColor(theme.accentLight, 30));
  planetGrad.addColorStop(0.5, theme.accent);
  planetGrad.addColorStop(1, darkenColor(theme.accent, 40));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = planetGrad;
  ctx.fill();

  // Shading
  const shadeGrad = ctx.createRadialGradient(cx + r*0.3, cy - r*0.3, 0, cx, cy, r);
  shadeGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
  shadeGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
  shadeGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = shadeGrad;
  ctx.fill();

  // Ring
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(theme.accentLight, 0.3);
  ctx.lineWidth   = 2;
  ctx.stroke();

  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line    = '';
  let lineY   = y;

  for (const word of words) {
    const testLine  = line ? `${line} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && line) {
      ctx.fillText(line, cx, lineY);
      line  = word;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, cx, lineY);
}

function measureText(ctx, text, font) {
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

// ─── COLOR UTILITIES ─────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lightenColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + amount);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, amount) {
  const r = Math.max(0, parseInt(hex.slice(1,3),16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3,5),16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5,7),16) - amount);
  return `rgb(${r},${g},${b})`;
}

// ─── DOWNLOAD / SHARE ─────────────────────────────────────────────────────────

/**
 * Download the canvas as a PNG file.
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename
 */
export function downloadCard(canvas, filename = 'carbomirror-card.png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas export failed')); return; }
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve();
    }, 'image/png', 0.95);
  });
}

/**
 * Share the canvas using the Web Share API (mobile) or fallback to download.
 * @param {HTMLCanvasElement} canvas
 * @param {string} shareText
 * @param {string} filename
 */
export async function nativeShare(canvas, shareText, filename = 'carbomirror-card.png') {
  // Attempt Web Share API Level 2 (file sharing)
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title:   'My Carbon Footprint — CarbonMirror',
          text:    shareText,
          files:   [file],
        });
        return { method: 'native-share' };
      }
    } catch (e) {
      if (e.name === 'AbortError') return { method: 'aborted' };
      // Fall through
    }
  }

  // Fallback: share text only (no file)
  if (navigator.share) {
    try {
      await navigator.share({ title: 'My Carbon Footprint — CarbonMirror', text: shareText });
      return { method: 'text-share' };
    } catch (e) {
      if (e.name === 'AbortError') return { method: 'aborted' };
    }
  }

  // Desktop fallback: download
  await downloadCard(canvas, filename);
  return { method: 'download' };
}

/**
 * Helper: Canvas → Blob (promisified)
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png', 0.95);
  });
}

/**
 * Generate share text for social media.
 * @param {CardData} data
 * @returns {string}
 */
export function generateShareText(data) {
  const kgFormatted = Math.round(data.totalKg).toLocaleString('en-IN');
  const tier = data.tier;
  const tierEmojis = { green: '🌱', yellow: '🌤️', orange: '⚠️', red: '🔴' };
  const emoji = tierEmojis[tier] || '🌍';

  const analogyLine = data.analogies
    ? `That's equal to ${data.analogies.delhiMumbaiDrives} Delhi→Mumbai drives or ${data.analogies.treesNeeded} trees needed to offset.`
    : '';

  const pledgeLine = data.pledge ? `\n\n💬 My pledge: "${data.pledge}"` : '';

  return `${emoji} My annual carbon footprint: ${kgFormatted} kg CO₂ — I'm a ${TIER_THEMES[tier]?.tierLabel || 'Carbon Tracker'}.\n\n${analogyLine}${pledgeLine}\n\nCalculate yours at CarbonMirror 👇\n#CarbonFootprint #SustainabilityIndia #ClimateAction #CarbonMirror`;
}

/**
 * @typedef {Object} CardData
 * @property {number}   totalKg   - Annual CO₂ in kg
 * @property {string}   tier      - 'green'|'yellow'|'orange'|'red'
 * @property {Object}   analogies - From getAnalogies()
 * @property {string}   userName  - Display name
 * @property {string}   pledge    - Pledge text
 */
