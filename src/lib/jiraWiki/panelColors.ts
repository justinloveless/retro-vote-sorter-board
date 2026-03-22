/**
 * Panel background colors for Jira wiki {panel:bgColor=...} — shared by viewer and rich editor.
 */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  const fullHex = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned;
  if (fullHex.length !== 6) return null;
  return {
    r: parseInt(fullHex.slice(0, 2), 16),
    g: parseInt(fullHex.slice(2, 4), 16),
    b: parseInt(fullHex.slice(4, 6), 16),
  };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Adjust a panel background color for readable contrast with the current
 * theme foreground. Works in HSL space so only lightness changes — hue and
 * saturation are preserved (saturation is slightly boosted to counteract
 * any washed-out appearance from lightness shifts).
 */
export function ensurePanelContrast(bgHex: string): string {
  const bg = hexToRgb(bgHex);
  if (!bg) return bgHex;

  const fgColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim()
    : '';

  let fgLum = 0;
  if (fgColor) {
    const temp = document.createElement('div');
    temp.style.color = `hsl(${fgColor})`;
    temp.style.display = 'none';
    document.body.appendChild(temp);
    const computed = getComputedStyle(temp).color;
    document.body.removeChild(temp);
    const rgbMatch = computed.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      fgLum = relativeLuminance(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
    }
  }

  const bgLum = relativeLuminance(bg.r, bg.g, bg.b);
  if (contrastRatio(fgLum, bgLum) >= 4.5) return bgHex;

  const hsl = rgbToHsl(bg.r, bg.g, bg.b);
  const shouldLighten = fgLum < 0.5;
  const step = shouldLighten ? 0.03 : -0.03;

  const boostedS = Math.min(1, hsl.s * 1.1);
  let l = hsl.l;

  for (let i = 0; i < 40; i++) {
    l = Math.min(1, Math.max(0, l + step));
    const rgb = hslToRgb(hsl.h, boostedS, l);
    const newLum = relativeLuminance(rgb.r, rgb.g, rgb.b);
    if (contrastRatio(fgLum, newLum) >= 4.5) {
      return `hsla(${Math.round(hsl.h * 360)}, ${Math.round(boostedS * 100)}%, ${Math.round(l * 100)}%, 0.45)`;
    }
  }

  return `hsla(${Math.round(hsl.h * 360)}, ${Math.round(boostedS * 100)}%, ${Math.round(l * 100)}%, 0.45)`;
}
