/* Drawing engine: a small tweened scene drawn on a canvas in a 1000 x 640 world. */
(function (root) {
  'use strict';
  const W = 1000, H = 640;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const FONT = '"Segoe UI", system-ui, Arial, sans-serif';

  function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mixCol(a, b, m) {
    if (m <= 0) return a;
    const A = rgb(a), B = rgb(b);
    return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], m))).join(',') + ')';
  }

  const SIZES = [{ L: 52, g: 13, w: 11 }, { L: 26, g: 7, w: 8 }, { L: 13, g: 4, w: 6 }];

  function armCol(arm) { return arm.c1 ? mixCol(arm.c0, arm.c1, arm.m) : arm.c0; }

  class Scene {
    constructor() {
      this.tweens = [];
      this.time = 0;
      this.instant = false;
      this.dur = 1.2;
      this.labels = [];
      this.labelAlpha = 0;
      this.cellKey = null;
    }

    init(colours) {
      this.chs = [];
      for (let p = 0; p < 3; p++) {
        for (let h = 0; h < 2; h++) {
          const id = p * 2 + h, s = SIZES[p], col = colours[id];
          this.chs.push({
            id, pair: p, hom: h, L: s.L, g: s.g, w: s.w, col,
            x: 500, y: 320, rot: 0, sc: 1, bend: 0, mv: 0, nest: 0,
            dir: [-1, 1], alpha: 1, att: 'none', bow: 0, bulge: p === 0 ? 17 : 0,
            ph: Math.random() * 6.28, pts: [],
            arms: [[{ c0: col, c1: null, m: 0 }, { c0: col, c1: null, m: 0 }],
                   [{ c0: col, c1: null, m: 0 }, { c0: col, c1: null, m: 0 }]]
          });
        }
      }
      // Crossing over pattern: large = whole chromatid, medium = bottom half of a chromatid, small = none.
      // Inner chromatids (A chromatid 0, B chromatid 1) are the ones that swap, as in the textbook picture.
      const c = this.chs;
      [0, 1].forEach(j => { c[0].arms[0][j].c1 = c[1].col; c[1].arms[1][j].c1 = c[0].col; });
      c[2].arms[0][1].c1 = c[3].col; c[3].arms[1][1].c1 = c[2].col;

      this.cell = { rx: 290, ry: 290, k: 0, sep: 0, alpha: 1 };
      this.ghost = { rx: 290, ry: 290, k: 0, sep: 0, alpha: 0 };
      this.nuc = [{ x: 500, y: 320, rx: 205, ry: 205, alpha: 1, dash: false },
                  { x: 700, y: 320, rx: 130, ry: 150, alpha: 0, dash: false }];
      this.cen = [{ x: 250, y: 320, alpha: 1 }, { x: 750, y: 320, alpha: 1 }];
      this.spin = { grow: 0, alpha: 1 };
      this.eq = { alpha: 0 };
      this.chiasma = { alpha: 0 };
      this.cellKey = null;
      this.tweens = [];
      this.labels = [];
    }

    go(obj, props, delay, dur) {
      delay = delay || 0; dur = dur == null ? this.dur : dur;
      for (const k in props) {
        const to = props[k];
        this.tweens = this.tweens.filter(t => !(t.o === obj && t.k === k));
        if (typeof to !== 'number' || this.instant || obj[k] === to) { obj[k] = to; continue; }
        this.tweens.push({ o: obj, k, from: obj[k], to, t0: this.time + delay, dur });
      }
    }

    seq(obj, k, start, list) {
      this.tweens = this.tweens.filter(t => !(t.o === obj && t.k === k));
      if (this.instant) { obj[k] = list[list.length - 1][0]; return; }
      obj[k] = start; let from = start;
      for (const [to, delay, dur] of list) { this.tweens.push({ o: obj, k, from, to, t0: this.time + delay, dur }); from = to; }
    }

    stop(obj) { this.tweens = this.tweens.filter(t => t.o !== obj); }

    update(dt) {
      this.time += dt;
      const keep = [];
      for (const t of this.tweens) {
        const p = (this.time - t.t0) / t.dur;
        if (p <= 0) { keep.push(t); continue; }
        if (p >= 1) { t.o[t.k] = t.to; continue; }
        t.o[t.k] = lerp(t.from, t.to, ease(p));
        keep.push(t);
      }
      this.tweens = keep;
    }

    setLabels(list) {
      this.labels = list;
      this.tweens = this.tweens.filter(t => t.o !== this || t.k !== 'labelAlpha');
      if (this.instant) { this.labelAlpha = 1; return; }
      this.labelAlpha = 0;
      this.go(this, { labelAlpha: 1 }, 0.9, 0.5);
    }

    /* ---------- anchors ---------- */
    cpt(ch, i) { return ch.pts[i || 0] ? ch.pts[i || 0].C : { x: ch.x, y: ch.y }; }
    armPt(ch, i, arm, f) {
      const p = ch.pts[i]; if (!p) return { x: ch.x, y: ch.y };
      const E = arm === 0 ? p.A : p.B, K = arm === 0 ? p.cA : p.cB, C = p.M, u = f;
      return { x: (1 - u) * (1 - u) * C.x + 2 * (1 - u) * u * K.x + u * u * E.x,
               y: (1 - u) * (1 - u) * C.y + 2 * (1 - u) * u * K.y + u * u * E.y };
    }
    attach(ch, pole) {
      if (!ch.pts.length || ch.att === 'none') return null;
      if (ch.att === 'left' && pole !== 0) return null;
      if (ch.att === 'right' && pole !== 1) return null;
      if (ch.mv > 2) { const want = pole === 0 ? -1 : 1; return ch.pts[ch.dir[0] === want ? 0 : 1].C; }
      return ch.pts[0].C;
    }

    /* ---------- drawing ---------- */
    shapePaths(c) {
      const N = 56, right = [], left = [];
      const pt = (t, half) => {
        const S = { x: c.rx * Math.cos(t), y: c.ry * Math.sin(t) };
        if (c.k <= 0) return S;
        let D;
        if (half === 'r') { const u = Math.PI + 2 * (t + Math.PI / 2); D = { x: c.rx / 2 + c.rx / 2 * Math.cos(u), y: c.ry * Math.sin(u) }; }
        else { const u = 2 * (t - Math.PI / 2); D = { x: -c.rx / 2 + c.rx / 2 * Math.cos(u), y: c.ry * Math.sin(u) }; }
        return { x: lerp(S.x, D.x, c.k), y: lerp(S.y, D.y, c.k) };
      };
      for (let i = 0; i <= N; i++) right.push(pt(-Math.PI / 2 + Math.PI * i / N, 'r'));
      for (let i = 0; i <= N; i++) left.push(pt(Math.PI / 2 + Math.PI * i / N, 'l'));
      return { right, left };
    }

    drawCell(ctx, c) {
      if (c.alpha < 0.01) return;
      const sp = this.shapePaths(c);
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.lineWidth = 4; ctx.strokeStyle = '#3d5a80'; ctx.fillStyle = '#fff6dc'; ctx.lineJoin = 'round';
      const path = (pts, dx) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(500 + p.x + dx, 320 + p.y) : ctx.moveTo(500 + p.x + dx, 320 + p.y))); ctx.closePath(); };
      if (c.sep > 0.5) {
        path(sp.right, c.sep); ctx.fill(); ctx.stroke();
        path(sp.left, -c.sep); ctx.fill(); ctx.stroke();
      } else {
        path(sp.right.concat(sp.left), 0); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    drawNuc(ctx, n) {
      if (n.alpha < 0.01) return;
      ctx.save();
      ctx.globalAlpha = n.alpha;
      ctx.beginPath(); ctx.ellipse(n.x, n.y, n.rx, n.ry, 0, 0, 7);
      ctx.fillStyle = 'rgba(120,150,230,0.16)'; ctx.fill();
      ctx.strokeStyle = '#5c6bc0'; ctx.lineWidth = 4;
      if (n.dash) ctx.setLineDash([10, 9]);
      ctx.stroke();
      ctx.restore();
    }

    drawCentriole(ctx, c) {
      if (c.alpha < 0.01) return;
      ctx.save(); ctx.globalAlpha = c.alpha; ctx.translate(c.x, c.y);
      ctx.fillStyle = '#ff7043'; ctx.strokeStyle = '#8d2f12'; ctx.lineWidth = 1.5;
      const bar = (x, y, w, h) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke(); };
      bar(-11, -13, 22, 8); bar(-4, -3, 8, 22);
      ctx.restore();
    }

    drawCh(ctx, ch) {
      if (ch.alpha < 0.01) return;
      const t = this.time;
      const rot = ch.rot + Math.sin(t * 0.45 + ch.ph) * 0.03;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      const ox = ch.x + Math.sin(t * 0.5 + ch.ph) * 3, oy = ch.y + Math.cos(t * 0.42 + ch.ph * 1.3) * 3;
      const s = ch.sc, L = ch.L, g = ch.g, b = ch.bend;
      const tx = (px, py) => ({ x: ox + s * (px * cos - py * sin), y: oy + s * (px * sin + py * cos) });
      ch.pts = [];
      for (let i = 0; i < 2; i++) {
        // Chromosomes stand upright: arms run up and down, sister chromatids sit left and right.
        const d = ch.dir[i], sA = i === 0 ? -1 : 1, cx = d * ch.mv, tr = 0.45 * L + (i ? ch.nest * L / 52 : 0);
        const ax = lerp(cx + sA * g, cx - d * tr, b), ay = lerp(-L, -0.8 * L, b);
        const bx = lerp(cx - sA * g, cx - d * tr, b), by = lerp(L, 0.8 * L, b);
        const w1 = Math.sin(t * 1.3 + ch.ph + i * 1.7) * 3, w2 = Math.sin(t * 1.1 + ch.ph * 1.3 + i) * 3;
        const w3 = Math.sin(t * 0.9 + ch.ph * 2 + i) * 3, w4 = Math.cos(t * 1.0 + ch.ph + i * 2) * 3;
        const loc = { C: [cx, 0], M: [cx, 0], A: [ax + w1, ay], B: [bx + w2, by], cA: [(cx + ax) / 2 + w3, ay / 2], cB: [(cx + bx) / 2 + w4, by / 2] };
        if (ch.bow > 0.001 && ch.bulge > 0) {
          // The chromosome opens into ( ) so the inner chromatids bow towards their partner and touch at the middle.
          const bd = ch.hom ? -1 : 1, inner = i === (ch.hom ? 1 : 0), ex = cx;
          const mx = cx + bd * (inner ? ch.bulge : -0.45 * ch.bulge), pcx = 2 * mx - ex;
          const tg = { A: [ex + w1, -L], B: [ex + w2, L], M: [mx, 0], cA: [(ex + pcx) / 2 + w3, -L / 2], cB: [(ex + pcx) / 2 + w4, L / 2] };
          for (const k in tg) loc[k] = [lerp(loc[k][0], tg[k][0], ch.bow), lerp(loc[k][1], tg[k][1], ch.bow)];
        }
        const P = {}; for (const k in loc) P[k] = tx(loc[k][0], loc[k][1]);
        ch.pts.push(P);
      }
      ctx.save();
      ctx.globalAlpha = ch.alpha; ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const p = ch.pts[i];
        for (let pass = 0; pass < 2; pass++) {
          for (let j = 0; j < 2; j++) {
            const E = j === 0 ? p.A : p.B, K = j === 0 ? p.cA : p.cB;
            ctx.beginPath(); ctx.moveTo(p.M.x, p.M.y); ctx.quadraticCurveTo(K.x, K.y, E.x, E.y);
            if (pass === 0) { ctx.strokeStyle = 'rgba(25,25,50,0.6)'; ctx.lineWidth = (ch.w + 4) * s; }
            else { ctx.strokeStyle = armCol(ch.arms[i][j]); ctx.lineWidth = ch.w * s; }
            ctx.stroke();
          }
        }
      }
      const dots = ch.mv > 2 ? [0, 1] : [0];
      dots.forEach(i => {
        const C = ch.pts[i].C;
        ctx.beginPath(); ctx.arc(C.x, C.y, Math.max(2.5, 5 * Math.min(1, L / 40)) * s, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5; ctx.stroke();
      });
      ctx.restore();
    }

    drawSpindle(ctx) {
      if (this.spin.alpha < 0.01 || this.spin.grow < 0.01) return;
      ctx.save();
      ctx.globalAlpha = this.spin.alpha * 0.55;
      ctx.strokeStyle = '#5b6b8c'; ctx.lineWidth = 1.8;
      for (let pole = 0; pole < 2; pole++) {
        const c = this.cen[pole];
        this.chs.forEach(ch => {
          if (ch.alpha < 0.05) return;
          const tgt = this.attach(ch, pole);
          if (!tgt) return;
          ctx.globalAlpha = this.spin.alpha * 0.55 * ch.alpha;
          ctx.beginPath(); ctx.moveTo(c.x, c.y);
          ctx.lineTo(lerp(c.x, tgt.x, this.spin.grow), lerp(c.y, tgt.y, this.spin.grow));
          ctx.stroke();
        });
      }
      ctx.restore();
    }

    drawLabels(ctx) {
      if (this.labelAlpha < 0.01) return;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const l of this.labels) {
        const big = l.kind === 'process', chip = l.kind === 'chip';
        ctx.font = (big ? '700 22px ' : chip ? '700 19px ' : '600 19px ') + FONT;
        const w = ctx.measureText(l.text).width + 22, h = big ? 38 : 32;
        ctx.globalAlpha = this.labelAlpha;
        const a = l.anchor ? l.anchor() : null;
        if (a) {
          ctx.strokeStyle = big ? '#c2410c' : '#2d3a55'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(a.x, a.y); ctx.stroke();
          ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, 7); ctx.fillStyle = big ? '#c2410c' : '#2d3a55'; ctx.fill();
        }
        ctx.beginPath(); ctx.roundRect(l.x - w / 2, l.y - h / 2, w, h, 9);
        ctx.fillStyle = big ? '#fff1c2' : chip ? (l.col || '#e3f2e8') : '#ffffff'; ctx.fill();
        ctx.strokeStyle = big ? '#c2410c' : '#2d3a55'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = big ? '#7c2d12' : '#1b2540';
        ctx.fillText(l.text, l.x, l.y + 1);
      }
      ctx.restore();
    }

    draw(ctx) {
      ctx.clearRect(0, 0, W, H);
      this.drawCell(ctx, this.ghost);
      this.drawCell(ctx, this.cell);
      if (this.eq.alpha > 0.01) {
        ctx.save(); ctx.globalAlpha = this.eq.alpha; ctx.setLineDash([9, 9]);
        ctx.strokeStyle = '#9aa7c2'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(500, 40); ctx.lineTo(500, 600); ctx.stroke(); ctx.restore();
      }
      this.nuc.forEach(n => this.drawNuc(ctx, n));
      this.drawSpindle(ctx);
      this.cen.forEach(c => this.drawCentriole(ctx, c));
      this.chs.forEach(ch => this.drawCh(ctx, ch));
      if (this.chiasma.alpha > 0.01 && this.chiasmaPts) {
        ctx.save();
        const pulse = 1 + Math.sin(this.time * 4) * 0.12;
        this.chiasmaPts.forEach(p => {
          ctx.globalAlpha = this.chiasma.alpha; ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, (p.r || 24) * pulse, 0, 7); ctx.stroke();
        });
        ctx.restore();
      }
      this.drawLabels(ctx);
    }
  }

  /* A plain straight chromatid rod, used by the summary screen. */
  function drawRod(ctx, x, y, L, w, c0, c1, time, ph) {
    const wob = Math.sin(time * 1.2 + ph) * 2.5, wob2 = Math.cos(time * 1.0 + ph * 1.7) * 2.5;
    const A = { x: x - L, y: y + wob }, B = { x: x + L, y: y + wob2 }, K = { x, y: y + (wob + wob2) / 2 };
    ctx.save(); ctx.lineCap = 'round';
    [[A, c0], [B, c1]].forEach(([E, col]) => {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + E.x) / 2, (y + E.y) / 2 + wob2, E.x, E.y);
      ctx.strokeStyle = 'rgba(25,25,50,0.6)'; ctx.lineWidth = w + 3; ctx.stroke();
    });
    [[A, c0], [B, c1]].forEach(([E, col]) => {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + E.x) / 2, (y + E.y) / 2 + wob2, E.x, E.y);
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    });
    ctx.restore();
  }

  root.CD = root.CD || {};
  root.CD.Scene = Scene;
  root.CD.drawRod = drawRod;
  root.CD.armCol = armCol;
  root.CD.SIZES = SIZES;
  root.CD.FONT = FONT;
  root.CD.W = W; root.CD.H = H;
})(window);
