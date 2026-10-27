/* Step sequences for mitosis and meiosis. Each step has an apply() that sets the full target state. */
(function (root) {
  'use strict';
  const CX = 500, CY = 320;
  const SCAT6 = [[430, 240, -0.6], [575, 252, 0.5], [420, 342, 0.9], [585, 350, -0.9], [480, 418, 0.3], [548, 402, -0.4]];
  const SCAT3 = [[435, 255, -0.5], [565, 330, 0.6], [472, 412, 0.2]];
  const MIT_ORDER = [0, 3, 4, 1, 2, 5];

  function GEO(name, m2) {
    const r = m2 ? 280 : 290;
    const none = { x: CX, y: CY, rx: 130, ry: 150, alpha: 0 };
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
        return { rx, ry: cy ? (m2 ? 210 : 215) : (m2 ? 235 : 245), k: cy ? 1 : 0.55, sep: cy ? 20 : 0, lobe,
          cen: [CX - (lobe + rx / 2 - 30), CX + (lobe + rx / 2 - 30)], apex: 0,
          nuc: [{ x: CX - lobe, y: CY, rx: 130, ry: 150, alpha: 1 }, { x: CX + lobe, y: CY, rx: 130, ry: 150, alpha: 1 }] };
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
    }
  };

  function build(sc, S) {
    const mit = S.kind === 'mitosis';
    const chs = sc.chs;
    const sideOf = ch => (S.sides[ch.pair] === ch.hom ? -1 : 1);
    const setOf = side => [0, 1, 2].map(p => chs[p * 2 + (side === 0 ? S.sides[p] : 1 - S.sides[p])]);

    const BASE = { rot: 0, sc: 1, bend: 0, mv: 0, nest: 0, alpha: 1, att: 'none' };

    function place(ch, o) {
      o = Object.assign({}, BASE, o);
      if (ch.alpha < 0.05 && !sc.instant) {
        const a = o.alpha; delete o.alpha;
        sc.stop(ch); Object.assign(ch, o); ch.alpha = 0; sc.go(ch, { alpha: a }, 0.2, 0.7);
      } else sc.go(ch, o);
    }
    function hide(list) { chs.forEach(c => { if (!list.includes(c)) sc.go(c, { alpha: 0 }, 0, 0.6); }); }

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
      sc.go(sc.spin, { grow: spin.grow, alpha: spin.alpha });
      sc.go(sc.eq, { alpha: eq ? 1 : 0 });
      return g;
    }

    function cross(v, delay, dur) {
      chs.forEach(c => c.arms.forEach(a => a.forEach(arm => { if (arm.c1) sc.go(arm, { m: v }, delay, dur); })));
    }
    function chiasma(on, pts) { sc.chiasmaPts = pts || sc.chiasmaPts; sc.go(sc.chiasma, { alpha: on ? 1 : 0 }, on ? 2.6 : 0, 0.5); }

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

    /* ---------- shared layouts ---------- */
    function scatter6() { chs.forEach(ch => place(ch, { x: SCAT6[ch.id][0], y: SCAT6[ch.id][1], rot: SCAT6[ch.id][2] })); }
    function scatter3(set) { set.forEach((ch, p) => place(ch, { x: SCAT3[p][0], y: SCAT3[p][1], rot: SCAT3[p][2] })); }

    const steps = [];

    /* ==================== MITOSIS ==================== */
    if (mit) {
      const geoTelo = GEO('telo', false);
      steps.push({
        phase: 'Prophase', sub: 'Chromosomes condense',
        text: 'The cell starts with 3 pairs of chromosomes (6 in total). Each chromosome has already been copied, so it is X shaped: two identical <b>sister chromatids</b> joined at the centromere. In prophase the chromosomes condense and become easy to see inside the <b>nucleus</b>. The <b>centrioles</b> sit at opposite poles of the cell.',
        apply() {
          stage('main', 'pro', false, { grow: 0, alpha: 1 }, false, false);
          scatter6(); cross(0, 0, 0.1);
          sc.setLabels([L('Nucleus', 95, 150, nucPt(0, 215)), L('Centriole', 95, 440, cenPt(0)), chipD('Parent cell: Diploid (2n = 6)', 215, 35)]);
        }
      });
      steps.push({
        phase: 'Prophase', sub: 'Nuclear envelope breaks down',
        text: 'The nuclear envelope breaks down, so the chromosomes are free in the cell. <b>Spindle fibres</b> start to grow out from the centrioles towards the chromosomes.',
        apply() {
          stage('main', 'pro', false, { grow: 0.45, alpha: 1 }, false, true);
          sc.go(sc.nuc[0], { alpha: 0.28 }, 0, 2.2);
          chs.forEach(ch => place(ch, { x: SCAT6[ch.id][0], y: SCAT6[ch.id][1], rot: SCAT6[ch.id][2], att: 'both' }));
          sc.setLabels([L('Nuclear envelope breaking down', 215, 35, nucPt(0, 235)), L('Spindle fibres', 905, 150, fibre(chs[1], 1, 0.7)), L('Centriole', 905, 470, cenPt(1))]);
        }
      });
      steps.push({
        phase: 'Metaphase', sub: 'Single file at the equator',
        highlight: 'The chromosomes line up in a single file along the equator of the cell.',
        text: 'Spindle fibres from both centrioles attach to the <b>centromere</b> of every chromosome. This lines the chromosomes up across the middle of the cell, ready to be split. Notice that the chromosomes are <b>not</b> in pairs. Homologous chromosomes do not pair up in mitosis.',
        apply() {
          stage('main', 'meta', false, { grow: 1, alpha: 1 }, true, false);
          MIT_ORDER.forEach((id, i) => place(chs[id], { x: CX, y: CY + (i - 2.5) * 88, att: 'both' }));
          sc.setLabels([L('Spindle fibres', 905, 140, fibre(chs[MIT_ORDER[0]], 1, 0.5)), L('Centriole', 95, 440, cenPt(0)), L('Centriole', 905, 470, cenPt(1))]);
        }
      });
      steps.push({
        phase: 'Anaphase', sub: 'Chromatids pulled apart',
        text: 'The <b>centromeres</b> split, so each X separates into two single chromosomes (the old sister chromatids). The <b>spindle fibres</b> shorten and pull one copy of every chromosome towards each pole. Each pole receives a full set of chromosomes.',
        apply() {
          const g = stage('main', 'ana', false, { grow: 1, alpha: 1 }, true, false);
          MIT_ORDER.forEach((id, i) => { chs[id].dir = [-1, 1]; place(chs[id], { x: CX, y: CY + (i - 2.5) * 88, bend: 1, mv: g.apex, att: 'both' }); });
          sc.setLabels([L('Centromere', 905, 60, cPt(chs[MIT_ORDER[0]], 1)), L('Spindle fibres', 905, 590, fibre(chs[MIT_ORDER[5]], 1, 0.6)), L('Centriole', 95, 440, cenPt(0))]);
        }
      });
      steps.push({
        phase: 'Telophase', sub: 'New nuclei form',
        text: 'The chromosomes reach the poles. A new <b>nuclear envelope</b> forms around each set of chromosomes and the spindle fibres break down. The cell begins to pinch in the middle.',
        apply() {
          const g = stage('main', 'telo', false, { grow: 1, alpha: 0 }, false, false);
          chs.forEach(ch => place(ch, { x: CX + (ch.hom ? 32 : -32), y: CY + (ch.pair - 1) * 82, bend: 0.5, sc: 0.8, mv: g.lobe, att: 'none' }));
          sc.setLabels([L('Nucleus', 500, 32, nucPt(0, 270)), L('Nucleus', 500, 608, nucPt(1, 90)), L('Centriole', 95, 440, cenPt(0)), L('Centriole', 905, 440, cenPt(1))]);
        }
      });
      steps.push({
        phase: 'Cytokinesis', sub: 'The cell divides',
        text: 'The cytoplasm divides and the cell pinches apart into <b>two separate cells</b>. The two daughter cells are <b>identical</b> to each other and to the parent cell. Each is <b>diploid</b>, with 3 pairs of chromosomes.',
        apply() {
          const g = stage('main', 'cyto', false, { grow: 1, alpha: 0 }, false, false);
          chs.forEach(ch => place(ch, { x: CX + (ch.hom ? 32 : -32), y: CY + (ch.pair - 1) * 82, bend: 0.5, sc: 0.8, mv: g.lobe, att: 'none' }));
          sc.setLabels([chipD('Diploid (2n = 6)', 280, 55), chipD('Diploid (2n = 6)', 720, 55),
            { text: 'Identical cells', x: 500, y: 608, kind: 'process' }]);
        }
      });
      return steps;
    }

    /* ==================== MEIOSIS ==================== */
    const pairRowY = p => CY + (p - 1) * 140;
    const metaRowY = p => CY + (p - 1) * 150;

    steps.push({
      phase: 'Prophase I', sub: 'Chromosomes condense',
      text: 'The cell starts with 3 pairs of chromosomes (6 in total). Each chromosome has already been copied, so it is X shaped: two identical <b>sister chromatids</b> joined at the centromere. In Prophase I the chromosomes condense and become easy to see inside the <b>nucleus</b>. The <b>centrioles</b> sit at opposite poles of the cell.',
      apply() {
        stage('I', 'pro', false, { grow: 0, alpha: 1 }, false, false);
        scatter6(); cross(0, 0, 0.1); chiasma(false);
        sc.setLabels([L('Nucleus', 95, 150, nucPt(0, 215)), L('Centriole', 95, 440, cenPt(0)), chipD('Parent cell: Diploid (2n = 6)', 215, 35)]);
      }
    });
    steps.push({
      phase: 'Prophase I', sub: 'Crossing over', popup: 'cross', replay: true,
      text: 'Homologous chromosomes find their partner and <b>pair up</b>. Where two non-sister chromatids touch (a <b>chiasma</b>), they swap matching sections of DNA. This is <b>crossing over</b>. Each pair crosses over differently:' +
        '<ul><li><b>Large pair:</b> swaps a whole chromatid</li><li><b>Medium pair:</b> swaps one end (half) of a chromatid</li><li><b>Small pair:</b> does not cross over</li></ul>' +
        'Crossing over makes new combinations of alleles on the chromatids, so it creates <b>variation</b>.',
      apply() {
        stage('I', 'pro', false, { grow: 0, alpha: 1 }, false, false);
        sc.dur = 1.6;
        chs.forEach(ch => place(ch, { x: CX, y: pairRowY(ch.pair) + (ch.hom ? 34 : -34) }));
        sc.dur = 1.2;
        cross(1, 2.0, 2.2);
        chiasma(true, [0, 1, 2].map(p => ({ x: CX, y: pairRowY(p) })));
        sc.setLabels([
          { text: 'Crossing over', x: 500, y: 32, kind: 'process' },
          L('Chromatid', 95, 140, () => sc.armPt(chs[0], 0, 0, 0.8)),
          L('Centromere', 905, 150, cPt(chs[1], 0)),
          L('Chiasma', 95, 330, () => ({ x: CX - 26, y: pairRowY(1) }))
        ]);
        sc.labelsDelay = 3.5;
      }
    });
    steps.push({
      phase: 'Prophase I', sub: 'Nuclear envelope breaks down',
      text: 'The nuclear envelope breaks down and <b>spindle fibres</b> grow out from the centrioles towards the chromosomes. The homologous pairs stay together.',
      apply() {
        stage('I', 'pro', false, { grow: 0.45, alpha: 1 }, false, true);
        sc.go(sc.nuc[0], { alpha: 0.28 }, 0, 2.2);
        chs.forEach(ch => place(ch, { x: CX, y: pairRowY(ch.pair) + (ch.hom ? 34 : -34), att: sideOf(ch) < 0 ? 'left' : 'right' }));
        cross(1, 0, 0.1); chiasma(false);
        sc.setLabels([L('Nuclear envelope breaking down', 215, 35, nucPt(0, 235)), L('Spindle fibres', 905, 150, fibre(chs[1], 1, 0.7)), L('Centriole', 95, 470, cenPt(0))]);
      }
    });
    steps.push({
      phase: 'Metaphase I', sub: 'Pairs line up', popup: 'assort', randomise: true,
      highlight: 'Homologous chromosomes line up in pairs at the equator, one on each side.',
      text: 'Spindle fibres attach to the <b>centromere</b> of each chromosome. Each homologous pair lines up with one homologue facing each pole. Which homologue faces which pole is random, and each pair does this independently. This is <b>independent assortment</b>. Press <b>Randomise</b> to shuffle the arrangement as many times as you like.',
      apply() {
        stage('I', 'meta', false, { grow: 1, alpha: 1 }, true, false);
        cross(1, 0, 0.1); chiasma(false);
        chs.forEach(ch => { const s = sideOf(ch); place(ch, { x: CX + s * 42, y: metaRowY(ch.pair) + s * 36, att: s < 0 ? 'left' : 'right' }); });
        const lc = setOf(0);
        sc.setLabels([{ text: 'Independent assortment', x: 500, y: 30, kind: 'process' },
          L('Spindle fibres', 905, 150, fibre(chs[0].hom === S.sides[0] ? chs[1] : chs[0], 1, 0.5)), L('Centriole', 95, 470, cenPt(0))]);
      }
    });
    steps.push({
      phase: 'Anaphase I', sub: 'Homologues pulled apart',
      text: 'The spindle fibres pull the two homologous chromosomes of each pair towards <b>opposite poles</b>. The centromeres do <b>not</b> split, so each chromosome is still X shaped. The homologues separate at random (<b>random segregation</b>), so each pole gets a different mix of chromosomes. This halves the chromosome number.',
      apply() {
        const g = stage('I', 'ana', false, { grow: 1, alpha: 1 }, true, false);
        cross(1, 0, 0.1);
        chs.forEach(ch => { const s = sideOf(ch); ch.dir = [s, s]; place(ch, { x: CX + s * g.apex, y: metaRowY(ch.pair), bend: 1, nest: 14, att: s < 0 ? 'left' : 'right' }); });
        sc.setLabels([L('Spindle fibres', 905, 60, fibre(setOf(1)[0], 1, 0.6)), L('Centriole', 95, 470, cenPt(0))]);
      }
    });
    steps.push({
      phase: 'Telophase I', sub: 'New nuclei form',
      text: 'The chromosomes reach the poles. A new <b>nuclear envelope</b> forms around each set of chromosomes and the spindle fibres break down. The cell begins to pinch in the middle.',
      apply() {
        const g = stage('I', 'telo', false, { grow: 1, alpha: 0 }, false, false);
        chs.forEach(ch => { const s = sideOf(ch); ch.dir = [s, s]; place(ch, { x: CX + s * g.lobe, y: CY + (ch.pair - 1) * 90, bend: 0.6, nest: 12, sc: 0.8, att: 'none' }); });
        sc.setLabels([L('Nucleus', 500, 32, nucPt(0, 270)), L('Nucleus', 500, 608, nucPt(1, 90)), L('Centriole', 95, 440, cenPt(0)), L('Centriole', 905, 440, cenPt(1))]);
      }
    });
    steps.push({
      phase: 'Cytokinesis I', sub: 'Two cells form',
      text: 'The cytoplasm divides and the cell pinches apart into <b>two separate cells</b>. Each new cell has only one chromosome from each homologous pair, so each is <b>haploid</b>. The chromosomes are still X shaped. Next, each cell goes through meiosis II, one at a time.',
      apply() {
        const g = stage('I', 'cyto', false, { grow: 1, alpha: 0 }, false, false);
        chs.forEach(ch => { const s = sideOf(ch); ch.dir = [s, s]; place(ch, { x: CX + s * g.lobe, y: CY + (ch.pair - 1) * 90, bend: 0.6, nest: 12, sc: 0.8, att: 'none' }); });
        sc.setLabels([chipD('Haploid (n = 3)', 280, 55), chipD('Haploid (n = 3)', 720, 55)]);
      }
    });

    /* ---------- Meiosis II (left cell, then right cell) ---------- */
    [0, 1].forEach(side => {
      const key = 'II' + side, tag = side === 0 ? 'Left cell' : 'Right cell';
      const set = () => setOf(side);
      const segDirs = ch => { const sg = S.segr[ch.id]; return sg === 0 ? [-1, 1] : [1, -1]; };
      steps.push({
        phase: 'Prophase II', sub: tag, side,
        text: '<b>Very little happens in Prophase II.</b> The chromosomes are already condensed, and this cell has only 3 of them (haploid). The nuclear envelope breaks down again and a new spindle begins to form.',
        apply() {
          const s = set(); hide(s);
          stage(key, 'pro', true, { grow: 0.45, alpha: 1 }, false, true);
          sc.go(sc.nuc[0], { alpha: 0.35 }, 0, 2.2);
          s.forEach((ch, p) => { ch.dir = segDirs(ch); place(ch, { x: SCAT3[p][0], y: SCAT3[p][1], rot: SCAT3[p][2], att: 'both' }); });
          sc.setLabels([L('Nuclear envelope breaking down', 215, 35, nucPt(0, 235)), L('Spindle fibres', 905, 150, fibre(s[0], 1, 0.7)), L('Centriole', 95, 470, cenPt(0))]);
        }
      });
      steps.push({
        phase: 'Metaphase II', sub: tag, side,
        highlight: 'The chromosomes line up in a single file along the equator.',
        text: 'Spindle fibres from both poles attach to the <b>centromere</b> of each chromosome. This time the chromosomes line up single file, not in pairs, because the homologues were separated in meiosis I.',
        apply() {
          const s = set(); hide(s);
          stage(key, 'meta', true, { grow: 1, alpha: 1 }, true, false);
          s.forEach((ch, p) => { ch.dir = segDirs(ch); place(ch, { x: CX, y: CY + (p - 1) * 140, att: 'both' }); });
          sc.setLabels([L('Spindle fibres', 905, 150, fibre(s[0], 1, 0.5)), L('Centriole', 95, 470, cenPt(0)), L('Centriole', 905, 470, cenPt(1))]);
        }
      });
      steps.push({
        phase: 'Anaphase II', sub: tag, side,
        text: 'The <b>centromeres</b> split and the spindle fibres pull the sister chromatids to opposite poles. Crossing over has made sister chromatids different from each other, so which chromatid goes to which pole is <b>random</b>. This is <b>random segregation</b>, and it makes the daughter cells non-identical.',
        apply() {
          const s = set(), g = stage(key, 'ana', true, { grow: 1, alpha: 1 }, true, false); hide(s);
          s.forEach((ch, p) => { ch.dir = segDirs(ch); place(ch, { x: CX, y: CY + (p - 1) * 140, bend: 1, mv: g.apex, att: 'both' }); });
          sc.setLabels([{ text: 'Random segregation', x: 500, y: 30, kind: 'process' },
            L('Centromere', 905, 150, cPt(s[0], 1)), L('Spindle fibres', 95, 590, fibre(s[2], 0, 0.6))]);
        }
      });
      steps.push({
        phase: 'Telophase II', sub: tag, side,
        text: 'The chromatids (now called chromosomes) reach the poles. A new <b>nuclear envelope</b> forms around each set and the spindle fibres break down. The cell begins to pinch in the middle.',
        apply() {
          const s = set(), g = stage(key, 'telo', true, { grow: 1, alpha: 0 }, false, false); hide(s);
          s.forEach(ch => { ch.dir = segDirs(ch); place(ch, { x: CX, y: CY + (ch.pair - 1) * 82, bend: 0.5, sc: 0.8, mv: g.lobe, att: 'none' }); });
          sc.setLabels([L('Nucleus', 500, 32, nucPt(0, 270)), L('Nucleus', 500, 608, nucPt(1, 90)), L('Centriole', 95, 440, cenPt(0)), L('Centriole', 905, 440, cenPt(1))]);
        }
      });
      steps.push({
        phase: 'Cytokinesis II', sub: tag, side, doneSide: side,
        text: 'The cytoplasm divides and this cell pinches apart into <b>two separate cells</b>. Each daughter cell is <b>haploid</b> with 3 single chromosomes. ' +
          (side === 0 ? 'Now repeat the process for the right cell.' : 'Together, the four daughter cells are <b>non-identical</b>.'),
        apply() {
          const s = set(), g = stage(key, 'cyto', true, { grow: 1, alpha: 0 }, false, false); hide(s);
          s.forEach(ch => { ch.dir = segDirs(ch); place(ch, { x: CX, y: CY + (ch.pair - 1) * 82, bend: 0.5, sc: 0.8, mv: g.lobe, att: 'none' }); });
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
