// Sunset Cover Studio — wires the page: pick a layout and grade, load photos into
// panels, drag to crop, type a caption, export the cover as a PNG. A `?shot=`
// query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, LAYOUTS, GRADES, SIZES, SAMPLE_PHOTOS, panelRects } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const panelList = document.getElementById('panels');

const state = {
  layout: 'trio',
  grade: 'sunset',
  size: '1080x1080',
  title: 'Sunset Heist',
  subtitle: 'Palm Shores · 2026',
  titlePos: 'bottom',
  selected: 0,
  panels: [],
};

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function panelCount() {
  return LAYOUTS[state.layout].panels;
}

function ensurePanels() {
  while (state.panels.length < panelCount()) {
    const first = state.panels[0];
    state.panels.push(first ? { ...first } : { photo: null, src: null, zoom: 1, ox: 0.5, oy: 0.5 });
  }
  state.panels.length = panelCount();
  if (state.selected >= panelCount()) state.selected = 0;
}

function sizeCanvas() {
  const { w, h } = SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function redraw() {
  ensurePanels();
  sizeCanvas();
  drawCover(canvas, state);
  renderPanelList();
}

function setStatus(text) {
  status.textContent = text;
}

/** The per-panel card: thumbnail, upload, sample picker, zoom, centre. */
function renderPanelList() {
  panelList.innerHTML = '';
  state.panels.forEach((panel, i) => {
    const card = document.createElement('div');
    card.className = 'panel-card' + (i === state.selected ? ' selected' : '');
    card.addEventListener('click', () => { state.selected = i; redraw(); });

    const thumb = document.createElement('canvas');
    thumb.width = 96;
    thumb.height = 96;
    thumb.className = 'thumb';
    if (panel.photo) {
      const tctx = thumb.getContext('2d');
      const s = Math.max(96 / panel.photo.naturalWidth, 96 / panel.photo.naturalHeight);
      tctx.drawImage(panel.photo, (96 - panel.photo.naturalWidth * s) / 2, (96 - panel.photo.naturalHeight * s) / 2, panel.photo.naturalWidth * s, panel.photo.naturalHeight * s);
    } else {
      const tctx = thumb.getContext('2d');
      tctx.fillStyle = '#3a2350';
      tctx.fillRect(0, 0, 96, 96);
      tctx.fillStyle = 'rgba(255,255,255,0.8)';
      tctx.font = '12px sans-serif';
      tctx.textAlign = 'center';
      tctx.fillText('EMPTY', 48, 52);
    }
    card.appendChild(thumb);

    const body = document.createElement('div');
    body.className = 'panel-body';
    const name = document.createElement('strong');
    name.textContent = `Panel ${i + 1}${panel.src ? ' — ' + panel.src : ''}`;
    body.appendChild(name);

    const row = document.createElement('div');
    row.className = 'row';
    const upload = document.createElement('label');
    upload.className = 'mini-btn';
    upload.textContent = 'Upload photo';
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.hidden = true;
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      panel.photo = await loadImage(URL.createObjectURL(f));
      panel.src = f.name;
      panel.zoom = 1;
      panel.ox = 0.5;
      panel.oy = 0.5;
      state.selected = i;
      redraw();
      setStatus(`Panel ${i + 1}: ${f.name} loaded.`);
    });
    upload.appendChild(file);
    row.appendChild(upload);

    const sample = document.createElement('select');
    sample.setAttribute('aria-label', `Sample photo for panel ${i + 1}`);
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Sample…';
    sample.appendChild(none);
    SAMPLE_PHOTOS.forEach((s) => {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = s;
      sample.appendChild(o);
    });
    sample.addEventListener('change', async () => {
      if (!sample.value) return;
      panel.photo = await loadImage(`samples/${sample.value}.jpg`);
      panel.src = sample.value;
      panel.zoom = 1;
      panel.ox = 0.5;
      panel.oy = 0.5;
      state.selected = i;
      redraw();
      setStatus(`Panel ${i + 1}: sample “${sample.value}” loaded.`);
    });
    row.appendChild(sample);
    body.appendChild(row);

    const zoomRow = document.createElement('div');
    zoomRow.className = 'row';
    const zoomLabel = document.createElement('label');
    zoomLabel.textContent = 'Zoom';
    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '3';
    zoom.step = '0.05';
    zoom.value = String(panel.zoom || 1);
    zoom.setAttribute('aria-label', `Zoom panel ${i + 1}`);
    zoom.addEventListener('input', () => { panel.zoom = Number(zoom.value); redraw(); });
    zoomRow.appendChild(zoomLabel);
    zoomRow.appendChild(zoom);
    const centre = document.createElement('button');
    centre.type = 'button';
    centre.className = 'mini-btn';
    centre.textContent = 'Centre';
    centre.addEventListener('click', () => { panel.ox = 0.5; panel.oy = 0.5; panel.zoom = 1; redraw(); });
    zoomRow.appendChild(centre);
    body.appendChild(zoomRow);

    card.appendChild(body);
    panelList.appendChild(card);
  });
}

/** Segmented control: one button per choice, wired to a state key. */
function wireChoices(id, choices, key, after) {
  const wrap = document.getElementById(id);
  Object.entries(choices).forEach(([value, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.dataset.value = value;
    b.textContent = typeof label === 'string' ? label : label.label;
    b.addEventListener('click', () => {
      state[key] = value;
      wrap.querySelectorAll('.choice').forEach((x) => x.classList.toggle('active', x === b));
      if (after) after();
      redraw();
    });
    if (state[key] === value) b.classList.add('active');
    wrap.appendChild(b);
  });
}

wireChoices('layout-choices', LAYOUTS, 'layout');
wireChoices('grade-choices', GRADES, 'grade');
wireChoices('size-choices', SIZES, 'size');

document.getElementById('fill-all').addEventListener('click', async () => {
  const first = state.panels[0];
  if (!first || !first.photo) { setStatus('Load a photo into Panel 1 first.'); return; }
  ensurePanels();
  state.panels.forEach((p) => { p.photo = first.photo; p.src = first.src; p.zoom = 1; p.ox = 0.5; p.oy = 0.5; });
  redraw();
  setStatus('All panels now use the Panel 1 photo.');
});

const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
document.getElementById('title-top').addEventListener('click', () => { state.titlePos = 'top'; redraw(); });
document.getElementById('title-bottom').addEventListener('click', () => { state.titlePos = 'bottom'; redraw(); });

document.getElementById('export').addEventListener('click', () => {
  const { w, h } = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, { ...state, selected: -1 });
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-${state.size}.png`;
    a.click();
    setStatus(`Saved cover-${state.size}.png`);
  }, 'image/png');
});

// Drag on the preview to pan the photo inside the panel under the pointer;
// the wheel zooms it. Clicking a panel selects it.
let drag = null;
function panelAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = (clientX - r.left) / r.width * canvas.width;
  const y = (clientY - r.top) / r.height * canvas.height;
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const i = rects.findIndex((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
  return i < 0 ? -1 : i;
}
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  state.selected = i;
  const panel = state.panels[i];
  drag = { i, x: e.clientX, y: e.clientY, ox: panel.ox, oy: panel.oy, moved: false };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const rect = rects[drag.i];
  const r = canvas.getBoundingClientRect();
  const panel = state.panels[drag.i];
  const dxPx = (e.clientX - drag.x) / r.width * canvas.width;
  const dyPx = (e.clientY - drag.y) / r.height * canvas.height;
  const iw = panel.photo ? panel.photo.naturalWidth : 0;
  const ih = panel.photo ? panel.photo.naturalHeight : 0;
  if (iw && ih) {
    const base = Math.max(rect.w / iw, rect.h / ih) * (panel.zoom || 1);
    const overflowX = Math.max(0, iw * base - rect.w);
    const overflowY = Math.max(0, ih * base - rect.h);
    if (overflowX > 0) panel.ox = Math.min(1, Math.max(0, drag.ox + dxPx / overflowX));
    if (overflowY > 0) panel.oy = Math.min(1, Math.max(0, drag.oy + dyPx / overflowY));
  }
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const i = state.selected;
  const panel = state.panels[i];
  if (!panel || !panel.photo) return;
  panel.zoom = Math.min(3, Math.max(1, (panel.zoom || 1) * (e.deltaY < 0 ? 1.1 : 0.9)));
  redraw();
}, { passive: false });

/** Waits for the shipped display fonts, then paints the first frame. */
async function ready() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('500 20px Oswald'),
      document.fonts.load('600 20px Oswald'),
    ]);
    await document.fonts.ready;
  } catch { /* system fallbacks still draw */ }
}

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  ready().then(() => runShot(shot, query, state, redraw, loadImage, setStatus));
} else {
  ready().then(async () => {
    // A friendly first frame: the pier sample in the hero panel.
    try {
      const img = await loadImage('samples/pier.jpg');
      state.panels = [{ photo: img, src: 'pier', zoom: 1, ox: 0.5, oy: 0.5 }];
    } catch { /* empty panels still draw */ }
    redraw();
  });
}
