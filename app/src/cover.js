// Sunset Cover Studio — the cover renderer.
//
// Draws a multi-panel GTA-style poster cover onto a canvas: the user's photos,
// cropped and positioned per panel, a sunset / neon / gold / noir colour grade,
// and bold display lettering. Everything is drawn with the canvas 2D API and
// the fonts shipped under app/fonts/, so the app works fully offline.

export const LAYOUTS = {
  hero: { panels: 1, label: 'Hero — one big photo' },
  duo: { panels: 2, label: 'Duo — two tall panels' },
  trio: { panels: 3, label: 'Trio — hero + two stacked' },
  quad: { panels: 4, label: 'Quad — four panels' },
};

export const GRADES = {
  sunset: 'Sunset — warm orange into pink',
  neon: 'Neon Night — cyan and magenta',
  gold: 'Vice Gold — amber haze',
  noir: 'Noir — black and white',
};

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

export const SAMPLE_PHOTOS = ['rider', 'neon', 'pier', 'boulevard'];

/** The panel rectangles for a layout, as fractions of the cover (x, y, w, h). */
export function panelRects(layout, w, h) {
  const g = Math.round(Math.min(w, h) * 0.012); // panel gap in px
  const F = (x, y, pw, ph) => ({ x: x * w, y: y * h, w: pw * w, h: ph * h, g });
  switch (layout) {
    case 'duo':
      return [F(0, 0, 0.5, 1), F(0.5, 0, 0.5, 1)];
    case 'trio':
      return [F(0, 0, 0.62, 1), F(0.62, 0, 0.38, 0.5), F(0.62, 0.5, 0.38, 0.5)];
    case 'quad':
      return [F(0, 0, 0.5, 0.5), F(0.5, 0, 0.5, 0.5), F(0, 0.5, 0.5, 0.5), F(0.5, 0.5, 0.5, 0.5)];
    case 'hero':
    default:
      return [F(0, 0, 1, 1)];
  }
}

/** The canvas filter a grade applies to each photo draw. */
function photoFilter(grade) {
  switch (grade) {
    case 'neon': return 'saturate(1.3) contrast(1.08)';
    case 'gold': return 'saturate(1.12) sepia(0.28) contrast(1.02)';
    case 'noir': return 'grayscale(1) contrast(1.18) brightness(1.06)';
    case 'sunset':
    default: return 'saturate(1.18) contrast(1.05)';
  }
}

/** The colour wash a grade paints over a finished panel. */
function gradeWash(ctx, rect, grade) {
  const { x, y, w, h } = rect;
  const top = ctx.createLinearGradient(0, y, 0, y + h);
  const side = ctx.createLinearGradient(x, 0, x + w, 0);
  if (grade === 'sunset') {
    top.addColorStop(0, 'rgba(70, 20, 110, 0.16)');
    top.addColorStop(0.55, 'rgba(255, 110, 60, 0.05)');
    top.addColorStop(1, 'rgba(200, 30, 110, 0.34)');
  } else if (grade === 'neon') {
    side.addColorStop(0, 'rgba(0, 220, 255, 0.15)');
    side.addColorStop(1, 'rgba(255, 0, 180, 0.20)');
    top.addColorStop(0, 'rgba(10, 10, 40, 0.10)');
    top.addColorStop(1, 'rgba(255, 0, 140, 0.16)');
  } else if (grade === 'gold') {
    top.addColorStop(0, 'rgba(255, 200, 90, 0.06)');
    top.addColorStop(1, 'rgba(255, 150, 30, 0.26)');
  } else {
    top.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    top.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
  }
  ctx.save();
  ctx.fillStyle = side;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = top;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Draws one photo into a panel rect, cover-fit, panned by (ox, oy) in 0..1 and zoomed. */
function drawPhoto(ctx, photo, rect, zoom, ox, oy, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!photo) {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#3a2350');
    grad.addColorStop(1, '#160f22');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `600 ${Math.max(14, w * 0.045)}px Oswald, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ADD A PHOTO', x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const base = Math.max(w / iw, h / ih);
  const scale = base * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2 + (ox - 0.5) * Math.max(0, dw - w);
  const dy = y + (h - dh) / 2 + (oy - 0.5) * Math.max(0, dh - h);
  ctx.filter = photoFilter(grade);
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.filter = 'none';
  gradeWash(ctx, rect, grade);
  ctx.restore();
}

/** Fits the title to the cover width and returns its font size. */
function titleSize(ctx, text, w, h) {
  let size = h * 0.115;
  ctx.font = `${size}px Anton, sans-serif`;
  while (ctx.measureText(text).width > w * 0.92 && size > 16) {
    size -= 2;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

function drawLettering(ctx, state, w, h) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  if (!title && !subtitle) return;
  const bottom = state.titlePos !== 'top';
  const size = title ? titleSize(ctx, title, w, h) : 0;
  const bandH = size * 1.9 + (subtitle ? h * 0.045 : 0);
  const bandY = bottom ? h - bandH - h * 0.02 : h * 0.02;
  // Legibility band behind the lettering.
  const band = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (bottom) {
    band.addColorStop(0, 'rgba(8, 4, 18, 0)');
    band.addColorStop(1, 'rgba(8, 4, 18, 0.72)');
  } else {
    band.addColorStop(0, 'rgba(8, 4, 18, 0.72)');
    band.addColorStop(1, 'rgba(8, 4, 18, 0)');
  }
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, w, bandH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (title) {
    const ty = bottom ? h - h * 0.055 - (subtitle ? h * 0.045 : 0) : bandY + size * 1.05;
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.09);
    ctx.strokeStyle = 'rgba(12, 5, 24, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.03;
    ctx.strokeText(title, w / 2, ty);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, w / 2, ty);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (subtitle) {
    const subSize = Math.max(13, h * 0.026);
    const sy = bottom ? h - h * 0.045 : bandY + size * 1.05 + subSize * 1.3;
    ctx.font = `500 ${subSize}px Oswald, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, subSize * 0.22)}px`; } catch { /* older canvas: ignore */ }
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText(subtitle, w / 2, sy);
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }
}

/**
 * Draws the whole cover for `state` onto `canvas` at the canvas's own size.
 * state: { layout, grade, title, subtitle, titlePos, panels: [{photo, zoom, ox, oy}] }
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d0a12';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  const gap = rects[0].g;
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || {};
    // Inset each panel by half the gap so the gaps read as panel seams.
    const inset = {
      x: rect.x + (rect.x > 0 ? gap / 2 : 0),
      y: rect.y + (rect.y > 0 ? gap / 2 : 0),
      w: rect.w - (rect.x > 0 ? gap / 2 : 0) - (rect.x + rect.w < w ? gap / 2 : 0),
      h: rect.h - (rect.y > 0 ? gap / 2 : 0) - (rect.y + rect.h < h ? gap / 2 : 0),
    };
    drawPhoto(ctx, panel.photo || null, inset, panel.zoom || 1, panel.ox ?? 0.5, panel.oy ?? 0.5, state.grade);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.003);
    ctx.strokeRect(inset.x, inset.y, inset.w, inset.h);
    if (i === state.selected) {
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.006);
      ctx.strokeRect(inset.x - 2, inset.y - 2, inset.w + 4, inset.h + 4);
    }
  });
  // Soft vignette over the whole cover.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  drawLettering(ctx, state, w, h);
}
