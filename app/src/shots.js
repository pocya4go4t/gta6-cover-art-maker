// Fixed scenes for screenshots: ?shot=cover shows the cover alone, ?shot=editor
// shows the page with photos loaded. Query knobs: layout, grade, size,
// photos (comma list of sample names, one per panel), caption, subtitle,
// titlepos (top|bottom). window.__shotReady is set once painted.
import { SIZES } from './cover.js';

export async function runShot(shot, query, state, redraw, loadImage, setStatus) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const layout = query.get('layout');
  if (layout) state.layout = layout;
  const grade = query.get('grade');
  if (grade) state.grade = grade;
  const size = query.get('size');
  if (size && SIZES[size]) state.size = size;
  const titlePos = query.get('titlepos');
  if (titlePos) state.titlePos = titlePos;
  const caption = query.get('caption');
  if (caption !== null) {
    state.title = caption;
    const input = document.getElementById('title');
    if (input) input.value = caption;
  }
  const subtitle = query.get('subtitle');
  if (subtitle !== null) {
    state.subtitle = subtitle;
    const input = document.getElementById('subtitle');
    if (input) input.value = subtitle;
  }
  const names = (query.get('photos') || query.get('photo') || 'pier').split(',');
  const photos = [];
  for (const name of names) {
    try {
      photos.push({ photo: await loadImage(`samples/${name.trim()}.jpg`), src: name.trim(), zoom: 1, ox: 0.5, oy: 0.5 });
    } catch {
      photos.push({ photo: null, src: name.trim(), zoom: 1, ox: 0.5, oy: 0.5 });
    }
  }
  state.panels = photos;
  state.selected = -1;
  redraw();
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
  if (setStatus) setStatus('Shot scene ready.');
}
