/* Step sequences for mitosis and meiosis. Each step has an apply() that sets the full target state. */
(function (root) {
  'use strict';
  const CX = 500, CY = 320;
  const SCAT6 = [[430, 240, -0.6], [575, 252, 0.5], [420, 342, 0.9], [585, 350, -0.9], [480, 418, 0.3], [548, 402, -0.4]];
  const SCAT3 = [[435, 255, -0.5], [565, 330, 0.6], [472, 412, 0.2]];
  const MIT_ORDER = [0, 3, 4, 1, 2, 5];

  function GEO(name, m2) {
    const r = m2 ? 280 : 295;
    const none = { x: CX, y: CY, rx: 120, ry: 160, alpha: 0 };
    switch (name) {
      case 'pro': case 'meta': {
        const nr = m2 ? 185 : 205;
        return { rx: r, ry: r, k: 0, sep: 0, cen: [CX - (r - 40), CX + (r - 40)], apex: 0,
          nuc: [{ x: CX, y: CY, rx: nr, ry: nr, alpha: name === 'pro' ? 1 : 0 }, none] };
      }
      case 'ana': {
        const rx = m2 ? 330 : 340;
        return { rx, ry: m2 ? 265 : 280, k: 0, sep: 0, cen: [CX - (rx - 38), CX + (rx - 38)], apex: rx - 105,
          nuc: [{ x: CX, y: CY, rx: 150, ry: 150, alpha: 0 }, none] };
      }
      case 'telo': case 'cyto': {
        const rx = m2 ? 390 : 400, cy = name === 'cyto', lobe = rx / 2 + (cy ? 20 : 0);
        return { rx, ry: cy ? (m2 ? 215 : 220) : (m2 ? 240 : 250), k: cy ? 1 : 0.55, sep: cy ? 20 : 0, lobe,
          cen: [CX - (lobe + rx / 2 - 30), CX + (lobe + rx / 2 - 30)], apex: 0,
          nuc: [{ x: CX - lobe, y: CY, rx: 120, ry: 160, alpha: 1 }, { x: CX + lobe, y: CY, rx: 120, ry: 160, alpha: 1 }] };
      }
    }
  }

  const POP = {
    cross: {
      title: 'Crossing over',
      body: '<p><b>When:</b> Prophase I, after the homologous chromosomes have paired up.</p>' +
        '<p><b>How:</b> Non-sister chromatids from the two homologues touch at points called <b>chiasmata</b> and swap matching sections of DNA.</p>' +
        '<p><b>Link to variation:</b> After the swap, each chromatid carries a new mix of alleles that did not exist before. This means the gametes made by meiosis are genetically different from each other, which increases variation.</p>',
      button: 'Watch it happen'
    },
    assort: {
      title: 'Independent assortment',
      body: '<p><b>When:</b> Metaphase I.</p>' +
        '<p><b>How:</b> Homologous pairs line up at the equator with one homologue on each side. Which homologue faces which pole is random, and every pair does this independently of the other pairs. So the homologous pairs can line up in different ways.</p>' +
        '<p><b>Link to variation:</b> Different combinations of chromosomes end up in each daughter cell, so gametes differ from each other and from the parent.</p>' +
        '<p><b>Your turn:</b> Press <b>Randomise</b> to shuffle how your pairs line up. Press it as many times as you like. The arrangement you stop on is carried through the rest of meiosis.</p>',
      button: 'Got it'
    },
    segr: {
      title: 'Random segregation',
      body: '<p><b>When:</b> Anaphase II (set up here in Metaphase II).</p>' +
        '<p><b>How:</b> After crossing over, the two sister chromatids of a chromosome are no longer identical. Each chromosome can face the poles either way round, so which chromatid goes to which pole is random. Every chromosome does this independently.</p>' +
        '<p><b>Link to variation:</b> Different combinations of chromatids end up in each daughter cell, so the 4 cells are all genetically different.</p>' +
        '<p><b>Your turn:</b> Press <b>Randomise</b> to rotate your chromosomes. Press it as many times as you like. The way round they end up decides which chromatid moves left and which moves right in Anaphase II.</p>',
      button: 'Got it'
    }
  };

  const ul = items => '<ul>' + items.map(i => '<li>' + i + '</li>').join('') + '</ul>';

  function build(sc, S) {
    const mit = S.kind === 'mitosis';
    const chs = sc.chs;
    const sideOf = ch => (S.sides[ch.pair] === ch.hom ? -1 : 1);
    const setOf = side => [0, 1, 2].map(p => chs[p * 2 + (side === 0 ? S.sides[p] : 1 - S.sides[p])]);
    const homOn = (p, s) => chs[p * 2 + (s < 0 ? S.sides[p] : 1 - S.sides[p])];

    const BASE = { rot: 0, sc: 1, bend: 0, mv: 0, nest: 0, alpha: 1, att: 'none' };

    function place(ch, o) {
      o = Object.assign({}, BASE, o);
      if (ch.alpha < 0.05 && !sc.instant) {
        const a = o.alpha; delete o.alpha;
        sc.stop(ch); Object.assign(ch, o); ch.alpha = 0; sc.go(ch, { alpha: a }, 0.2, 0.7);
      } else sc.go(ch, o);
    }
    function hide(list) { chs.forEach(c => { if (!list.includes(c)) sc.go(c, { alpha: 0 }, 0, 0.6); }); }

    // Chromosomes standing in single file down the equator, centred vertically.
    function fileY(list, gap) {
      const hs = list.map(c => 2 * c.L), total = hs.reduce((a, b) => a + b, 0) + gap * (list.length - 1);
      let y = CY - total / 2;
      return list.map((c, i) => { const m = y + hs[i] / 2; y += hs[i] + gap; return m; });
    }

    function stage(key, name, m2, spin, eq, dash) {
      const g = GEO(name, m2), changed = sc.cellKey !== key && sc.cellKey !== null;
      sc.cellKey = key;
      const tgt = { rx: g.rx, ry: g.ry, k: g.k, sep: g.sep };
      if (changed && !sc.instant) {
        Object.assign(sc.ghost, sc.cell); sc.stop(sc.ghost); sc.go(sc.ghost, { alpha: 0 }, 0, 0.7);
        sc.stop(sc.cell); Object.assign(sc.cell, tgt, { alpha: 0 }); sc.go(sc.cell, { alpha: 1 }, 0.1, 0.7);
      } else { sc.go(sc.cell, Object.assign({ alpha: 1 }, tgt)); }
      sc.nuc.forEach((n, i) => {
        const t = Object.assign({}, g.nuc[i]);
        n.dash = !!dash;
        if (changed && !sc.instant) { const a = t.alpha; sc.stop(n); Object.assign(n, t, { alpha: 0 }); sc.go(n, { alpha: a }, 0.1, 0.7); }
        else sc.go(n, t);
      });
      sc.cen.forEach((c, i) => {
        const t = { x: g.cen[i], y: CY, alpha: 1 };
        if (changed && !sc.instant) { sc.stop(c); Object.assign(c, t, { alpha: 0 }); sc.go(c, { alpha: 1 }, 0.1, 0.7); }
        else sc.go(c, t);
      });
      chs.forEach(c => sc.go(c, { bow: 0 }, 0, 0.5));
      sc.go(sc.spin, { grow: spin.grow, alpha: spin.alpha });
      sc.go(sc.eq, { alpha: eq ? 1 : 0 });
      return g;
    }

    function cross(v, delay, dur) {
      chs.forEach(c => c.arms.forEach(a => a.forEach(arm => { if (arm.c1) sc.go(arm, { m: v }, delay, dur); })));
    }
    function chiasma(on) {
      sc.chiasmaPts = [0, 1].map(p => { const c = PAIRC[p], r = c[2], d = p === 0 ? 0 : 0.6 * chs[p * 2].L;
        return { x: c[0] - Math.sin(r) * d, y: c[1] + Math.cos(r) * d, r: p === 0 ? 24 : 15 }; });
      sc.go(sc.chiasma, { alpha: on ? 1 : 0 }, on ? 2.6 : 0, 0.5);
    }

    // label helpers
    const L = (text, x, y, anchor, kind) => ({ text, x, y, anchor, kind });
    const nucPt = (i, deg) => () => { const n = sc.nuc[i], a = deg * Math.PI / 180; return { x: n.x + n.rx * Math.cos(a), y: n.y + n.ry * Math.sin(a) }; };
    const cenPt = i => () => ({ x: sc.cen[i].x, y: sc.cen[i].y });
    const cPt = (ch, i) => () => sc.cpt(ch, i || 0);
    const fibre = (ch, pole, f) => () => {
      const t = sc.attach(ch, pole), c = sc.cen[pole];
      if (!t) return { x: c.x, y: c.y };
      const u = f * sc.spin.grow; return { x: c.x + (t.x - c.x) * u, y: c.y + (t.y - c.y) * u };
    };
    const chipD = (text, x, y) => ({ text, x, y, kind: 'chip', col: '#e3f2e8' });

    const scatter6 = extra => chs.forEach(ch => place(ch, Object.assign({ x: SCAT6[ch.id][0], y: SCAT6[ch.id][1], rot: SCAT6[ch.id][2] }, extra)));
    const colOff = ch => (ch.hom ? 28 : -28);
    const pairY = p => CY + (p - 1) * 125;        // pair rows in prophase I and metaphase I
    const PAIR_DX = [24, 18, 12];                   // half the gap between the two homologues of each pair
    const pairX = ch => CX + (ch.hom ? 1 : -1) * PAIR_DX[ch.pair];
    // Where each pair sits (x, y, tilt) while it is crossing over, each in its own part of the nucleus.
    const PAIRC = [[445, 235, -0.3], [565, 330, 0.25], [470, 432, -0.2]];
    const crossPos = ch => { const c = PAIRC[ch.pair], d = (ch.hom ? 1 : -1) * PAIR_DX[ch.pair];
      return { x: c[0] + d * Math.cos(c[2]), y: c[1] + d * Math.sin(c[2]), rot: c[2] }; };

    const steps = [];

    /* ==================== MITOSIS ==================== */
    if (mit) {
      steps.push({
        phase: 'Prophase', sub: 'Chromosomes condense',
        text: ul(['Chromosomes are already copied: each is X shaped, with 2 identical <b>sister chromatids</b>.', 'They condense and become visible inside the <b>nucleus</b>.', '<b>Centrioles</b> sit at opposite poles of the cell.']),
        apply() {
          stage('main', 'pro', false, { grow: 0, alpha: 1 }, false, false);
          scatter6(); cross(0, 0, 0.1);
          sc.setLabels([L('Nucleus', 95, 150, nucPt(0, 215)), L('Centriole', 95, 440, cenPt(0)), chipD('Parent cell: Diploid (2n = 6)', 215, 35)]);
        }
      });
      steps.push({
        phase: 'Prophase', sub: 'Nuclear envelope breaks down',
        text: ul(['The nuclear envelope breaks down.', '<b>Spindle fibres</b> grow from the centrioles towards the chromosomes.']),
        apply() {
          stage('main', 'pro', false, { grow: 0.45, alpha: 1 }, false, true);
          sc.go(sc.nuc[0], { alpha: 0.28 }, 0, 2.2);
          scatter6({ att: 'both' });
          sc.setLabels([L('Nuclear envelope breaking down', 215, 35, nucPt(0, 235)), L('Spindle fibres', 905, 150, fibre(chs[1], 1, 0.7)), L('Centriole', 905, 470, cenPt(1))]);
        }
      });
      steps.push({
        phase: 'Metaphase', sub: 'Single file at the equator',
        highlight: 'The chromosomes line up in a single file along the equator of the cell.',
        text: ul(['Spindle fibres from both poles attach to the <b>centromere</b> of each chromosome.', 'Chromosomes are <b>not</b> in pairs. Homologous chromosomes do not pair up in mitosis.']),
        apply() {
          stage('main', 'meta', false, { grow: 1, alpha: 1 }, true, false);
          const list = MIT_ORDER.map(id => chs[id]), ys = fileY(list, 30);
          list.forEach((ch, i) => place(ch, { x: CX, y: ys[i], att: 'both' }));
          sc.setLabels([L('Spindle fibres', 905, 140, fibre(list[0], 1, 0.5)), L('Centriole', 95, 440, cenPt(0)), L('Centriole', 905, 470, cenPt(1))]);
        }
      });
      steps.push({
        phase: 'Anaphase', sub: 'Chromatids pulled apart',
        text: ul(['The <b>centromeres</b> split.', 'Spindle fibres shorten and pull the sister chromatids to opposite poles.', 'Each pole gets a full, identical set of chromosomes.']),
        apply() {
          const g = stage('main', 'ana', false, { grow: 1, alpha: 1 }, true, false);
          chs.forEach(ch => { ch.dir = [-1, 1]; place(ch, { x: CX + colOff(ch), y: CY + (ch.pair - 1) * 95, bend: 1, mv: g.apex, att: 'both' }); });
          sc.setLabels([L('Centromere', 905, 60, cPt(chs[1], 1)), L('Spindle fibres', 905, 590, fibre(chs[5], 1, 0.6)), L('Centriole', 95, 440, cenPt(0))]);
        }
      });
      const telo = name => function () {
        const g = stage('main', name, false, { grow: 1, alpha: 0 }, false, false);
        chs.forEach(ch => place(ch, { x: CX + colOff(ch), y: CY + (ch.pair - 1) * 95, bend: 0.5, sc: 0.9, mv: g.lobe, att: 'none' }));
      };
      steps.push({
        phase: 'Telophase', sub: 'New nuclei form',
        text: ul(['Chromosomes reach the poles.', 'A new <b>nuclear envelope</b> forms around each set.', 'The spindle breaks down and the cell starts to pinch in the middle.']),
        apply() {
          telo('telo')();
          sc.setLabels([L('Nucleus', 500, 32, nucPt(0, 270)), L('Nucleus', 500, 608, nucPt(1, 90)), L('Centriole', 95, 440, cenPt(0)), L('Centriole', 905, 440, cenPt(1))]);
        }
      });
      steps.push({
        phase: 'Cytokinesis', sub: 'The cell divides',
        text: ul(['The cytoplasm divides, forming <b>2 separate cells</b>.', 'The cells are <b>identical</b> to each other and to the parent cell.', 'Each is <b>diploid</b> (3 pairs of chromosomes).']),
        apply() {
          telo('cyto')();
          sc.setLabels([chipD('Diploid (2n = 6)', 280, 55), chipD('Diploid (2n = 6)', 720, 55),
            { text: 'Identical cells', x: 500, y: 608, kind: 'process' }]);
        }
      });
      return steps;
    }

    /* ==================== MEIOSIS ==================== */
    steps.push({
      phase: 'Prophase I', sub: 'Chromosomes condense',
      text: ul(['Chromosomes are already copied: each is X shaped, with 2 identical <b>sister chromatids</b>.', 'They condense and become visible inside the <b>nucleus</b>.', '<b>Centrioles</b> sit at opposite poles of the cell.']),
      apply() {
        stage('I', 'pro', false, { grow: 0, alpha: 1 }, false, false);
        scatter6(); cross(0, 0, 0.1); chiasma(false);
        sc.setLabels([L('Nucleus', 95, 150, nucPt(0, 215)), L('Centriole', 95, 440, cenPt(0)), chipD('Parent cell: Diploid (2n = 6)', 215, 35)]);
      }
    });
    steps.push({
      phase: 'Prophase I', sub: 'Crossing over', popup: 'cross', replay: true,
      text: ul(['Homologous chromosomes <b>pair up</b>.',
        'Non-sister chromatids touch at <b>chiasmata</b> and swap sections of DNA. This is <b>crossing over</b>.' +
        '<ul><li>Large pair: swaps a whole chromatid</li><li>Medium pair: swaps the bottom half of a chromatid</li><li>Small pair: no crossing over</li></ul>',
        'New allele combinations are made, so crossing over creates <b>variation</b>.']),
      apply() {
        stage('I', 'pro', false, { grow: 0, alpha: 1 }, false, false);
        sc.dur = 1.6;
        chs.forEach(ch => place(ch, crossPos(ch)));
        sc.dur = 1.2;
        // The large pair's swapping chromatids bow together to touch, swap, then relax.
        [chs[0], chs[1]].forEach(c => sc.seq(c, 'bow', 0, [[1, 1.7, 1.2], [0, 5.6, 1.2]]));
        cross(1, 3.2, 1.8); chiasma(true);
        sc.setLabels([
          { text: 'Crossing over', x: 500, y: 32, kind: 'process' },
          L('Chromatid', 95, 125, () => sc.armPt(chs[0], 0, 0, 0.8)),
          L('Centromere', 95, 330, cPt(chs[2], 0)),
          L('Chiasma', 905, 250, () => sc.chiasmaPts[1])
        ]);
      }
    });
    steps.push({
      phase: 'Prophase I', sub: 'Nuclear envelope breaks down',
      text: ul(['The nuclear envelope breaks down.', '<b>Spindle fibres</b> grow from the centrioles.', 'Homologous pairs stay together.']),
      apply() {
        stage('I', 'pro', false, { grow: 0.45, alpha: 1 }, false, true);
        sc.go(sc.nuc[0], { alpha: 0.28 }, 0, 2.2);
        chs.forEach(ch => place(ch, Object.assign(crossPos(ch), { att: ch.hom ? 'right' : 'left' })));
        cross(1, 0, 0.1); chiasma(false);
        sc.setLabels([L('Nuclear envelope breaking down', 215, 35, nucPt(0, 235)), L('Spindle fibres', 905, 150, fibre(chs[1], 1, 0.7)), L('Centriole', 95, 470, cenPt(0))]);
      }
    });
    steps.push({
      phase: 'Metaphase I', sub: 'Pairs line up', popup: 'assort', randomise: true,
      highlight: 'Homologous chromosomes line up in pairs at the equator, one on each side.',
      text: ul(['Spindle fibres attach to the <b>centromere</b> of each chromosome.', 'Which homologue faces which pole is random: <b>independent assortment</b>.', 'Press <b>Randomise</b> as many times as you like.']),
      apply() {
        stage('I', 'meta', false, { grow: 1, alpha: 1 }, true, false);
        cross(1, 0, 0.1); chiasma(false);
        chs.forEach(ch => { const s = sideOf(ch); place(ch, { x: CX + s * PAIR_DX[ch.pair], y: pairY(ch.pair), att: s < 0 ? 'left' : 'right' }); });
        sc.setLabels([{ text: 'Independent assortment', x: 500, y: 30, kind: 'process' },
          L('Spindle fibres', 905, 150, fibre(homOn(0, 1), 1, 0.5)), L('Centriole', 95, 470, cenPt(0))]);
      }
    });
    steps.push({
      phase: 'Anaphase I', sub: 'Homologues pulled apart',
      text: ul(['Spindle fibres pull the <b>homologues</b> of each pair to opposite poles.', 'Centromeres do <b>not</b> split: chromosomes stay X shaped.', 'Homologues separate at random (<b>random segregation</b>), so each pole gets a different mix.']),
      apply() {
        const g = stage('I', 'ana', false, { grow: 1, alpha: 1 }, true, false);
        cross(1, 0, 0.1);
        chs.forEach(ch => { const s = sideOf(ch); ch.dir = [s, s]; place(ch, { x: CX + s * g.apex, y: CY + (ch.pair - 1) * 110, bend: 1, nest: 12, att: s < 0 ? 'left' : 'right' }); });
        sc.setLabels([L('Spindle fibres', 905, 60, fibre(homOn(0, 1), 1, 0.6)), L('Centriole', 95, 470, cenPt(0))]);
      }
    });
    const teloI = name => function () {
      const g = stage('I', name, false, { grow: 1, alpha: 0 }, false, false);
      chs.forEach(ch => { const s = sideOf(ch); ch.dir = [s, s]; place(ch, { x: CX + s * g.lobe, y: CY + (ch.pair - 1) * 100, bend: 0.6, nest: 10, sc: 0.9, att: 'none' }); });
    };
    steps.push({
      phase: 'Telophase I', sub: 'New nuclei form',
      text: ul(['Chromosomes reach the poles.', 'A new <b>nuclear envelope</b> forms around each set.', 'The spindle breaks down and the cell starts to pinch in the middle.']),
      apply() {
        teloI('telo')();
        sc.setLabels([L('Nucleus', 500, 32, nucPt(0, 270)), L('Nucleus', 500, 608, nucPt(1, 90)), L('Centriole', 95, 440, cenPt(0)), L('Centriole', 905, 440, cenPt(1))]);
      }
    });
    steps.push({
      phase: 'Cytokinesis I', sub: 'Two cells form',
      text: ul(['The cytoplasm divides, forming <b>2 separate cells</b>.', 'Each has one chromosome from each pair: <b>haploid</b>.', 'Next, each cell goes through meiosis II, one at a time.']),
      apply() {
        teloI('cyto')();
        sc.setLabels([chipD('Haploid (n = 3)', 280, 55), chipD('Haploid (n = 3)', 720, 55)]);
      }
    });

    /* ---------- Meiosis II (left cell, then right cell) ---------- */
    [0, 1].forEach(side => {
      const key = 'II' + side, tag = side === 0 ? 'Left cell' : 'Right cell';
      const set = () => setOf(side);
      const segDirs = () => [-1, 1];                       // local directions; the chromosome's rotation decides which way round it faces
      const segRot = ch => (S.segr[ch.id] ? Math.PI : 0);
      steps.push({
        phase: 'Prophase II', sub: tag, side,
        text: ul(['<b>Very little happens</b> in Prophase II.', 'Chromosomes are still condensed. This cell has only 3 (haploid).', 'The nuclear envelope breaks down and a new spindle forms.']),
        apply() {
          const s = set(); hide(s);
          stage(key, 'pro', true, { grow: 0.45, alpha: 1 }, false, true);
          sc.go(sc.nuc[0], { alpha: 0.35 }, 0, 2.2);
          s.forEach((ch, p) => { ch.dir = segDirs(ch); place(ch, { x: SCAT3[p][0], y: SCAT3[p][1], rot: SCAT3[p][2], att: 'both' }); });
          sc.setLabels([L('Nuclear envelope breaking down', 215, 35, nucPt(0, 235)), L('Spindle fibres', 905, 150, fibre(s[0], 1, 0.7)), L('Centriole', 95, 470, cenPt(0))]);
        }
      });
      steps.push({
        phase: 'Metaphase II', sub: tag, side, popup: 'segr', randomise: 'segr',
        highlight: 'The chromosomes line up in a single file along the equator.',
        text: ul(['Spindle fibres from both poles attach to the <b>centromere</b> of each chromosome.', 'Each chromosome can face either way round: this is <b>random segregation</b>.', 'Press <b>Randomise</b> as many times as you like.']),
        apply() {
          const s = set(); hide(s);
          stage(key, 'meta', true, { grow: 1, alpha: 1 }, true, false);
          const ys = fileY(s, 60);
          s.forEach((ch, p) => { ch.dir = segDirs(ch); place(ch, { x: CX, y: ys[p], rot: segRot(ch), att: 'both' }); });
          sc.setLabels([{ text: 'Random segregation', x: 500, y: 30, kind: 'process' }, L('Spindle fibres', 905, 150, fibre(s[0], 1, 0.5)), L('Centriole', 95, 470, cenPt(0)), L('Centriole', 905, 470, cenPt(1))]);
        }
      });
      steps.push({
        phase: 'Anaphase II', sub: tag, side,
        text: ul(['The <b>centromeres</b> split.', 'Sister chromatids are pulled to opposite poles.', 'Crossing over made sister chromatids different, so which chromatid goes to which pole is random: <b>random segregation</b>.']),
        apply() {
          const s = set(), g = stage(key, 'ana', true, { grow: 1, alpha: 1 }, true, false); hide(s);
          s.forEach((ch, p) => { ch.dir = segDirs(ch); place(ch, { x: CX, y: CY + (p - 1) * 105, rot: segRot(ch), bend: 1, mv: g.apex, att: 'both' }); });
          sc.setLabels([{ text: 'Random segregation', x: 500, y: 30, kind: 'process' },
            L('Centromere', 905, 150, cPt(s[0], 1)), L('Spindle fibres', 95, 590, fibre(s[2], 0, 0.6))]);
        }
      });
      const teloII = name => function () {
        const s = set(), g = stage(key, name, true, { grow: 1, alpha: 0 }, false, false); hide(s);
        s.forEach(ch => { ch.dir = segDirs(ch); place(ch, { x: CX, y: CY + (ch.pair - 1) * 100, rot: segRot(ch), bend: 0.5, sc: 0.9, mv: g.lobe, att: 'none' }); });
      };
      steps.push({
        phase: 'Telophase II', sub: tag, side,
        text: ul(['Chromatids (now chromosomes) reach the poles.', 'A new <b>nuclear envelope</b> forms around each set.', 'The spindle breaks down and the cell starts to pinch in the middle.']),
        apply() {
          teloII('telo')();
          sc.setLabels([L('Nucleus', 500, 32, nucPt(0, 270)), L('Nucleus', 500, 608, nucPt(1, 90)), L('Centriole', 95, 440, cenPt(0)), L('Centriole', 905, 440, cenPt(1))]);
        }
      });
      steps.push({
        phase: 'Cytokinesis II', sub: tag, side, doneSide: side,
        text: ul(['The cytoplasm divides, forming <b>2 separate cells</b>.', 'Each is <b>haploid</b>, with 3 single chromosomes.',
          side === 0 ? 'Now repeat for the right cell.' : 'The 4 daughter cells are <b>non-identical</b>.']),
        apply() {
          teloII('cyto')();
          sc.setLabels([chipD('Haploid (n = 3)', 280, 55), chipD('Haploid (n = 3)', 720, 55),
            { text: 'Non-identical cells', x: 500, y: 608, kind: 'process' }]);
        }
      });
    });
    return steps;
  }

  root.CD = root.CD || {};
  root.CD.buildSteps = build;
  root.CD.POP = POP;
})(window);
