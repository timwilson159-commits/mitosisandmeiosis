/* UI flow: start, colour setup, step-through, summary. */
(function () {
  'use strict';
  const CD = window.CD;
  const $ = id => document.getElementById(id);

  const PALETTE = [
    ['Red', '#e53935'], ['Orange', '#fb8c00'], ['Yellow', '#fdd835'], ['Lime', '#9ccc65'],
    ['Green', '#2e9e4f'], ['Teal', '#26a69a'], ['Cyan', '#29b6f6'], ['Blue', '#3f51b5'],
    ['Purple', '#8e24aa'], ['Pink', '#ec407a'], ['Brown', '#8d6e63'], ['Slate', '#546e7a']
  ];
  const PAIR_NAMES = ['Large pair', 'Medium pair', 'Small pair'];
  const S = { kind: null, colours: ['#e53935', '#3f51b5', '#fb8c00', '#26a69a', '#8e24aa', '#9ccc65'], sel: 0, sides: [0, 0, 0], randomised: false, segr: [] };
  let sc = null, steps = [], idx = 0, popupOpen = false, pendingApply = null, screen = 'start';
  let sumSc = null;

  function show(name) {
    screen = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    if (name === 'model' || name === 'summary') fit();
  }

  /* ---------- start ---------- */
  document.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => {
    S.kind = b.dataset.kind; $('setup-title').textContent = 'Choose your colours for ' + (S.kind === 'mitosis' ? 'mitosis' : 'meiosis'); buildSetup(); show('colours');
  }));

  /* ---------- colour setup ---------- */
  function xSvg(col, size) {
    const L = [34, 26, 18][size], g = [9, 7, 5][size];
    const lines = [[-g, -L, g, L], [g, -L, -g, L]];
    return '<svg viewBox="-40 -40 80 80" width="86" height="86"><g stroke-linecap="round" fill="none">' +
      lines.map(l => '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '" stroke="#222" stroke-width="' + (11 - size) + '"/>').join('') +
      lines.map(l => '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '" stroke="' + col + '" stroke-width="' + (7 - size) + '"/>').join('') +
      '</g></svg>';
  }
  function buildSetup() {
    const pairs = $('pairs'); pairs.innerHTML = '';
    for (let p = 0; p < 3; p++) {
      const card = document.createElement('div'); card.className = 'pair-card';
      card.innerHTML = '<h3>' + PAIR_NAMES[p] + '</h3><div class="slots"></div>';
      for (let h = 0; h < 2; h++) {
        const id = p * 2 + h, b = document.createElement('button');
        b.className = 'slot' + (S.sel === id ? ' sel' : ''); b.dataset.id = id;
        const nm = PALETTE.find(c => c[1] === S.colours[id])[0];
        b.innerHTML = xSvg(S.colours[id], p) + '<span>Homologue ' + (h + 1) + '<br><b>' + nm + '</b></span>';
        b.addEventListener('click', () => { S.sel = id; buildSetup(); });
        card.querySelector('.slots').appendChild(b);
      }
      pairs.appendChild(card);
    }
    const pal = $('palette'); pal.innerHTML = '';
    PALETTE.forEach(([name, hex]) => {
      const owner = S.colours.indexOf(hex), used = owner >= 0 && owner !== S.sel;
      const b = document.createElement('button'); b.className = 'swatch' + (used ? ' used' : '') + (owner === S.sel ? ' current' : '');
      b.style.background = hex; b.title = name + (used ? ' (already used)' : ''); b.disabled = used;
      b.setAttribute('aria-label', name); b.innerHTML = '<span>' + name + '</span>';
      b.addEventListener('click', () => { S.colours[S.sel] = hex; if (S.sel < 5) S.sel++; buildSetup(); });
      pal.appendChild(b);
    });
  }
  $('colours-back').addEventListener('click', () => show('start'));
  $('colours-go').addEventListener('click', startModel);

  /* ---------- model ---------- */
  function startModel() {
    S.sides = [0, 0, 0]; S.randomised = false; S.segr = [0, 1, 2, 3, 4, 5].map(() => (Math.random() < 0.5 ? 0 : 1));
    sc = new CD.Scene(); sc.init(S.colours);
    steps = CD.buildSteps(sc, S);
    idx = 0; popupOpen = false;
    show('model');
    goStep(0, 1, true);
    $('minimap').classList.add('hidden');
    startLoop();
  }

  function setPanel(st) {
    $('phase-name').textContent = st.phase;
    $('phase-sub').textContent = st.sub || '';
    $('desc').innerHTML = st.text;
    const hl = $('highlight'); hl.innerHTML = st.highlight || ''; hl.classList.toggle('hidden', !st.highlight);
    $('btn-replay').classList.toggle('hidden', !st.replay);
    $('btn-explain').classList.toggle('hidden', !st.popup);
    $('btn-random').classList.toggle('hidden', !st.randomise);
    $('progress-text').textContent = 'Step ' + (idx + 1) + ' of ' + steps.length;
    $('progress-bar').style.width = ((idx + 1) / steps.length * 100) + '%';
    $('mode-name').textContent = S.kind === 'mitosis' ? 'Mitosis' : (st.side == null ? 'Meiosis I' : 'Meiosis II');
    const mm = $('minimap');
    mm.classList.toggle('hidden', st.side == null);
    if (st.side != null) {
      mm.querySelectorAll('.mm-cell').forEach((c, i) => {
        c.classList.toggle('active', i === st.side);
        c.classList.toggle('done', i < st.side || (i === st.side && st.doneSide === i));
      });
      $('mm-text').textContent = 'Working on the ' + (st.side === 0 ? 'left' : 'right') + ' cell';
    }
    updateNext();
  }

  function updateNext() {
    const st = steps[idx], locked = st.randomise && !S.randomised;
    $('btn-next').disabled = locked || popupOpen;
    $('btn-next').textContent = idx === steps.length - 1 ? 'Finish' : 'Next';
    $('btn-back').disabled = idx === 0 || popupOpen;
    $('hint').textContent = locked ? 'Press Randomise to continue.' : 'Tip: use the left and right arrow keys.';
    $('hint').classList.toggle('warn', locked);
  }

  function goStep(i, dir, first) {
    idx = i; const st = steps[i];
    setPanel(st);
    const run = () => { sc.dur = 1.2; sc.instant = !!first; st.apply(); sc.instant = false; };
    if (st.popup && dir > 0) { openPopup(st.popup, run); } else run();
  }

  function next() {
    if (popupOpen) { closePopup(); return; }
    if (screen !== 'model') return;
    const st = steps[idx];
    if (st.randomise && !S.randomised) { flash($('btn-random')); return; }
    if (idx < steps.length - 1) goStep(idx + 1, 1); else openSummary();
  }
  function back() {
    if (popupOpen || screen !== 'model' || idx === 0) return;
    goStep(idx - 1, -1);
  }
  function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }

  $('btn-next').addEventListener('click', next);
  $('btn-back').addEventListener('click', back);
  $('btn-home').addEventListener('click', () => { stopLoop(); show('start'); });
  $('btn-colours').addEventListener('click', () => { stopLoop(); buildSetup(); show('colours'); });

  $('btn-random').addEventListener('click', () => {
    const old = S.sides.join('');
    let n; do { n = [0, 1, 2].map(() => (Math.random() < 0.5 ? 0 : 1)); } while (n.join('') === old);
    S.sides = n; S.randomised = true;
    sc.dur = 0.9; steps[idx].apply(); sc.dur = 1.2; updateNext();
  });
  $('btn-replay').addEventListener('click', () => {
    if (popupOpen) return;
    sc.instant = true; steps[idx - 1].apply(); sc.instant = false;
    sc.dur = 1.2; steps[idx].apply();
  });
  $('btn-explain').addEventListener('click', () => { const st = steps[idx]; if (st.popup) openPopup(st.popup, null); });

  /* ---------- popup ---------- */
  function openPopup(key, then) {
    const p = CD.POP[key];
    $('popup-title').textContent = p.title; $('popup-body').innerHTML = p.body; $('popup-ok').textContent = p.button;
    $('popup').classList.add('open'); popupOpen = true; pendingApply = then; updateNext();
    setTimeout(() => $('popup-ok').focus(), 30);
  }
  function closePopup() {
    $('popup').classList.remove('open'); popupOpen = false;
    const f = pendingApply; pendingApply = null; if (f) f(); updateNext();
  }
  $('popup-ok').addEventListener('click', closePopup);

  /* ---------- keys ---------- */
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); if (screen === 'model') next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (screen === 'model') back(); else if (screen === 'summary') backFromSummary(); }
    else if (e.key === 'Escape' && popupOpen) closePopup();
  });

  /* ---------- summary ---------- */
  function openSummary() {
    sumSc = new CD.Scene(); sumSc.init(S.colours);
    show('summary');
    $('sum-title').textContent = S.kind === 'mitosis' ? 'Mitosis: summary' : 'Meiosis: summary';
    $('sum-text').innerHTML = S.kind === 'mitosis'
      ? '<ul><li>1 <b>diploid</b> parent cell (2n = 6)</li><li>Makes <b>2 diploid</b> daughter cells</li><li>Daughter cells are <b>identical</b> to each other and the parent</li><li>Each has the same 6 chromosomes as the parent</li></ul>'
      : '<ul><li>1 <b>diploid</b> parent cell (2n = 6)</li><li>Makes <b>4 haploid</b> daughter cells (n = 3)</li><li>Each has 1 chromosome from each pair</li><li>Cells are <b>non-identical</b> because of:<ul><li>crossing over</li><li>independent assortment</li><li>random segregation</li></ul></li></ul>';
  }
  function backFromSummary() { show('model'); goStep(steps.length - 1, -1); }
  $('sum-back').addEventListener('click', backFromSummary);
  $('sum-home').addEventListener('click', () => { stopLoop(); show('start'); });

  function finalCols(ch, c) { const a = ch.arms[c]; return a.map(x => (x.c1 ? x.c1 : x.c0)); }

  function drawSummary(ctx) {
    const t = sumSc.time, FONT = CD.FONT;
    ctx.clearRect(0, 0, 1000, 640);
    const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = '#fff6dc'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#3d5a80'; ctx.stroke(); };
    const arrow = (x1, y1, x2, y2) => {
      ctx.strokeStyle = '#2d3a55'; ctx.fillStyle = '#2d3a55'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 16 * Math.cos(a - 0.45), y2 - 16 * Math.sin(a - 0.45)); ctx.lineTo(x2 - 16 * Math.cos(a + 0.45), y2 - 16 * Math.sin(a + 0.45)); ctx.fill();
    };
    const text = (s, x, y, font, col) => { ctx.font = font + ' ' + FONT; ctx.fillStyle = col || '#1b2540'; ctx.textAlign = 'center'; ctx.fillText(s, x, y); };
    const mit = S.kind === 'mitosis';
    // parent
    circle(500, 115, 100);
    const sc2 = sumSc;
    sc2.chs.forEach(ch => {
      const px = [[-45, -40], [40, -42], [-50, 8], [48, 6], [-22, 52], [28, 50]][ch.id];
      ch.x = 500 + px[0]; ch.y = 115 + px[1]; ch.sc = 0.42; ch.alpha = 1; ch.rot = [-0.5, 0.4, 0.8, -0.8, 0.2, -0.3][ch.id];
      sc2.drawCh(ctx, ch);
    });
    text('Parent cell', 500, 250, '700 22px', '#1b2540');
    text('Diploid (2n = 6)', 500, 276, '600 19px', '#2e6b3a');
    // daughters
    const n = mit ? 2 : 4, xs = mit ? [290, 710] : [125, 375, 625, 875], r = mit ? 115 : 95, cy = 468;
    xs.forEach(x => arrow(500 + (x - 500) * 0.3, 292, x, cy - r - 12));
    const chs = sc2.chs;
    xs.forEach((x, k) => {
      circle(x, cy, r);
      if (mit) {
        chs.forEach(ch => {
          const col = k === 0 && false ? 0 : 0;
          const cx = x + (ch.hom ? 55 : -55), cyy = cy + (ch.pair - 1) * 46;
          CD.drawRod(ctx, cx, cyy, [34, 25, 17][ch.pair], [10, 9, 7][ch.pair], ch.col, ch.col, t, ch.id + k * 3);
        });
      } else {
        const cellSide = k < 2 ? 0 : 1, within = k % 2;
        [0, 1, 2].forEach(p => {
          const ch = chs[p * 2 + (cellSide === 0 ? S.sides[p] : 1 - S.sides[p])];
          const c = within === 0 ? S.segr[ch.id] : 1 - S.segr[ch.id];
          const cols = finalCols(ch, c);
          CD.drawRod(ctx, x, cy + (p - 1) * 46, [36, 27, 18][p], [12, 10, 8][p], cols[0], cols[1], t, ch.id + k * 2);
        });
      }
      text(mit ? 'Diploid (2n = 6)' : 'Haploid (n = 3)', x, cy + r + 28, '700 20px', '#2e6b3a');
    });
    text(mit ? 'Identical cells' : 'Non-identical cells', 500, 628, '700 24px', '#c2410c');
  }

  /* ---------- loop and sizing ---------- */
  let raf = null, last = 0;
  function startLoop() { if (raf) return; last = performance.now(); raf = requestAnimationFrame(loop); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = null; }
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (screen === 'model' && sc) { sc.update(dt); render($('stage'), c => sc.draw(c)); }
    else if (screen === 'summary' && sumSc) { sumSc.update(dt); render($('summary'), c => drawSummary(c)); }
    raf = requestAnimationFrame(loop);
  }
  function render(cv, fn) {
    const ctx = cv.getContext('2d'), k = cv.width / 1000;
    ctx.setTransform(k, 0, 0, k, 0, 0); fn(ctx);
  }
  function fit() {
    ['stage', 'summary'].forEach(id => {
      const cv = $(id), wrap = cv.parentElement; if (!wrap.clientWidth) return;
      const w = Math.min(wrap.clientWidth, wrap.clientHeight * 1.5625), h = w / 1.5625, d = window.devicePixelRatio || 1;
      cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    });
  }
  window.addEventListener('resize', fit);
  startLoop();
  buildSetup();
})();
