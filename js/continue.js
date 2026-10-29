/* Continue an existing meiosis model: pick the phase you are up to, then drag the chromosomes back to where they were. */
(function (root) {
  'use strict';
  const CD = root.CD;
  const $ = id => document.getElementById(id);
  const AFTER_META_II = ['Metaphase II', 'Anaphase II', 'Telophase II', 'Cytokinesis II'];

  CD.initContinue = function (env) {
    const S = env.S;
    let tmp = null, list = [], pick = null;

    function open() {
      tmp = new CD.Scene(); tmp.init(S.colours);
      const steps = CD.buildSteps(tmp, S);
      list = [];
      steps.forEach((st, i) => {
        const key = st.phase + '|' + st.side;
        if (!list.some(x => x.key === key)) list.push({ key, phase: st.phase, side: st.side, idx: i });
      });
      pick = null; S.sides = [0, 0, 0]; S.segr = [0, 0, 0, 0, 0, 0];
      render(); env.show('continue');
    }

    // A single chromatid: a capsule split into its top and bottom arm colours, with a centromere dot.
    function strip(cols, h) {
      const w = 16, H = h + 6;
      return '<svg viewBox="0 0 ' + (w + 6) + ' ' + H + '" width="' + (w + 6) + '" height="' + H + '" aria-hidden="true">' +
        '<defs><clipPath id="cp' + h + '"><rect x="3" y="3" width="' + w + '" height="' + h + '" rx="8"/></clipPath></defs>' +
        '<g clip-path="url(#cp' + h + ')"><rect x="3" y="3" width="' + w + '" height="' + h / 2 + '" fill="' + cols[0] + '"/><rect x="3" y="' + (3 + h / 2) + '" width="' + w + '" height="' + h / 2 + '" fill="' + cols[1] + '"/></g>' +
        '<rect x="3" y="3" width="' + w + '" height="' + h + '" rx="8" fill="none" stroke="#222" stroke-width="2.5"/>' +
        '<circle cx="' + (3 + w / 2) + '" cy="' + (3 + h / 2) + '" r="3.5" fill="#fff" stroke="#222" stroke-width="1.5"/></svg>';
    }
    const HEIGHT = [92, 56, 34];
    const cols = (ch, ci, flip) => { const f = env.finalCols(ch, ci); return flip ? [f[1], f[0]] : f; };

    // Pointer-based drag (works with mouse and touch). A plain click also toggles.
    function drag(el, grp, slot, toggle) {
      el.classList.add('dragitem'); el.title = 'Drag to the other side (or click)';
      el.addEventListener('pointerdown', e => {
        if (e.button) return; e.preventDefault();
        const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
        const ghost = el.cloneNode(true); ghost.classList.add('dragghost');
        let moved = false;
        const mv = ev => {
          if (!moved) { if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 5) return; moved = true; document.body.appendChild(ghost); el.classList.add('dragging'); }
          ghost.style.left = (ev.clientX - dx) + 'px'; ghost.style.top = (ev.clientY - dy) + 'px';
        };
        const up = ev => {
          document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
          ghost.remove(); el.classList.remove('dragging');
          if (!moved) { toggle(); return; }
          const u = document.elementFromPoint(ev.clientX, ev.clientY), t = u && u.closest('.dropslot');
          if (t && t.dataset.grp === grp && t !== slot) toggle();
        };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
      });
    }

    function slotEl(grp, label) {
      const s = document.createElement('div'); s.className = 'dropslot'; s.dataset.grp = grp;
      s.innerHTML = '<div class="slot-label">' + label + '</div>';
      return s;
    }
    const nm = id => env.colourName(S.colours[id]);

    function sidesPanel(e) {
      const box = document.createElement('div'); box.className = 'arr-block';
      const meiosisII = e.side != null;
      const L = meiosisII ? 'Left cell' : 'Left pole', R = meiosisII ? 'Right cell' : 'Right pole';
      box.innerHTML = '<h3>' + (meiosisII ? 'Which chromosomes did each cell get?' : 'Independent assortment: which side was each chromosome on?') + '</h3>' +
        '<p>Drag each chromosome to the side it was on in your model.</p>';
      const row = document.createElement('div'); row.className = 'pair-row';
      for (let p = 0; p < 3; p++) {
        const card = document.createElement('div'); card.className = 'arr-card';
        card.innerHTML = '<h4>' + ['Large', 'Medium', 'Small'][p] + ' pair</h4>';
        const two = document.createElement('div'); two.className = 'two';
        [0, 1].forEach(pos => {
          const id = p * 2 + (pos === 0 ? S.sides[p] : 1 - S.sides[p]), ch = tmp.chs[id];
          const slot = slotEl('p' + p, pos === 0 ? L : R);
          const item = document.createElement('div'); item.className = 'chrom';
          item.innerHTML = strip(cols(ch, 0), HEIGHT[p]) + strip(cols(ch, 1), HEIGHT[p]) + '<span>' + nm(id) + '</span>';
          slot.appendChild(item); two.appendChild(slot);
          drag(item, 'p' + p, slot, () => { S.sides[p] = 1 - S.sides[p]; render(); });
        });
        card.appendChild(two); row.appendChild(card);
      }
      box.appendChild(row);
      return box;
    }

    function orientPanel(side) {
      const box = document.createElement('div'); box.className = 'arr-block';
      const tag = side === 0 ? 'left' : 'right';
      box.innerHTML = '<h3>Random segregation: the ' + tag + ' cell at metaphase II</h3>' +
        '<p>Each chromosome faced one way or the other. Drag a chromatid onto its partner to swap them over.</p>';
      const row = document.createElement('div'); row.className = 'pair-row';
      for (let p = 0; p < 3; p++) {
        const id = p * 2 + (side === 0 ? S.sides[p] : 1 - S.sides[p]), ch = tmp.chs[id];
        const card = document.createElement('div'); card.className = 'arr-card';
        card.innerHTML = '<h4>' + nm(id) + '</h4>';
        if (p === 2) { card.innerHTML += '<p class="small-note">No crossing over, so it looks the same either way round.</p>'; row.appendChild(card); continue; }
        const r = S.segr[id] ? 1 : 0, two = document.createElement('div'); two.className = 'two';
        [0, 1].forEach(pos => {
          const ci = r ? 1 - pos : pos;
          const slot = slotEl('o' + id, pos === 0 ? 'Left' : 'Right');
          const item = document.createElement('div'); item.className = 'chrom';
          item.innerHTML = strip(cols(ch, ci, !!r), HEIGHT[p]);
          slot.appendChild(item); two.appendChild(slot);
          drag(item, 'o' + id, slot, () => { S.segr[id] = r ? 0 : 1; render(); });
        });
        card.appendChild(two); row.appendChild(card);
      }
      box.appendChild(row);
      return box;
    }

    function render() {
      const ph = $('cont-phases'); ph.innerHTML = '';
      const groups = [['Meiosis I', x => x.side == null], ['Meiosis II: left cell', x => x.side === 0], ['Meiosis II: right cell', x => x.side === 1]];
      groups.forEach(([title, f]) => {
        const h = document.createElement('h3'); h.textContent = title; ph.appendChild(h);
        list.filter(f).forEach(e => {
          const b = document.createElement('button'); b.className = 'phase-btn' + (pick === e ? ' sel' : ''); b.textContent = e.phase;
          b.addEventListener('click', () => { pick = e; render(); });
          ph.appendChild(b);
        });
      });
      const ar = $('cont-arrange'); ar.innerHTML = '';
      $('cont-go').disabled = !pick;
      if (!pick) { ar.innerHTML = '<p class="cont-empty">Click the phase you are up to.</p>'; return; }
      const head = document.createElement('h2'); head.textContent = pick.phase + (pick.side == null ? '' : (pick.side === 0 ? ' (left cell)' : ' (right cell)')); ar.appendChild(head);
      if (pick.phase === 'Prophase I') {
        const p = document.createElement('p'); p.textContent = 'Nothing to set up: Prophase I is the same every time. Press Continue to start there.'; ar.appendChild(p); return;
      }
      ar.appendChild(sidesPanel(pick));
      if (pick.side === 1) ar.appendChild(orientPanel(0));
      if (pick.side != null && AFTER_META_II.includes(pick.phase)) ar.appendChild(orientPanel(pick.side));
    }

    $('cont-back').addEventListener('click', () => env.show('colours'));
    $('cont-go').addEventListener('click', () => {
      if (!pick) return;
      const p = pick, late = AFTER_META_II.includes(p.phase);
      S.randomised = p.phase !== 'Prophase I';
      S.segrDone = [p.side === 1 || (p.side === 0 && late), p.side === 1 && late];
      env.start(p.idx);
    });
    return { open };
  };
})(window);
