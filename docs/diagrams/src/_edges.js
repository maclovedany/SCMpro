/* ── 직교 커넥터 엔진 (skill: diagram) ─────────────────────────────
   edges 배열 형식:
   { from:'id', to:'id', fs:'right', ts:'left', fa:0.5, ta:0.5,
     label:'텍스트', dash:true, both:false, mid:숫자(중간 세그먼트 좌표), cls:'blue',
     lat:0.5 (라벨 위치 비율), loff:[dx,dy] (라벨 오프셋), mono:true }
   fs/ts: 'left' | 'right' | 'top' | 'bottom'   fa/ta: 그 변 위의 위치(0~1)
────────────────────────────────────────────────────────────────────── */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function rectOf(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error('노드 없음: ' + id);
    let x = 0, y = 0, e = el;
    while (e && !e.classList.contains('stage')) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function port(r, side, at) {
    at = at == null ? 0.5 : at;
    switch (side) {
      case 'left':   return { x: r.x,          y: r.y + r.h * at, dx: -1, dy: 0 };
      case 'right':  return { x: r.x + r.w,    y: r.y + r.h * at, dx: 1,  dy: 0 };
      case 'top':    return { x: r.x + r.w * at, y: r.y,          dx: 0,  dy: -1 };
      case 'bottom': return { x: r.x + r.w * at, y: r.y + r.h,    dx: 0,  dy: 1 };
    }
  }

  // 직교 경로 계산
  function route(p0, p1, e) {
    const hs0 = p0.dx !== 0, hs1 = p1.dx !== 0;
    const pts = [p0];
    if (e.via) { e.via.forEach(v => pts.push({ x: v[0], y: v[1] })); pts.push(p1); return dedupe(pts); }
    if (hs0 && hs1) {
      if (p0.dx === -p1.dx) { // 마주보는 좌우변
        if (Math.abs(p0.y - p1.y) < 1) { pts.push(p1); return pts; }
        const mx = e.mid != null ? e.mid : (p0.x + p1.x) / 2;
        pts.push({ x: mx, y: p0.y }, { x: mx, y: p1.y }, p1);
      } else { // 같은 방향(U자)
        const mx = e.mid != null ? e.mid : (p0.dx > 0 ? Math.max(p0.x, p1.x) + 40 : Math.min(p0.x, p1.x) - 40);
        pts.push({ x: mx, y: p0.y }, { x: mx, y: p1.y }, p1);
      }
    } else if (!hs0 && !hs1) {
      if (p0.dy === -p1.dy) {
        if (Math.abs(p0.x - p1.x) < 1) { pts.push(p1); return pts; }
        const my = e.mid != null ? e.mid : (p0.y + p1.y) / 2;
        pts.push({ x: p0.x, y: my }, { x: p1.x, y: my }, p1);
      } else {
        const my = e.mid != null ? e.mid : (p0.dy > 0 ? Math.max(p0.y, p1.y) + 40 : Math.min(p0.y, p1.y) - 40);
        pts.push({ x: p0.x, y: my }, { x: p1.x, y: my }, p1);
      }
    } else if (hs0 && !hs1) { // 좌우 → 상하 : L자
      pts.push({ x: p1.x, y: p0.y }, p1);
    } else {                   // 상하 → 좌우 : L자
      pts.push({ x: p0.x, y: p1.y }, p1);
    }
    return dedupe(pts);
  }

  function dedupe(pts) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = out[out.length - 1], b = pts[i];
      if (Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5) out.push(b);
    }
    return out;
  }

  // 모서리 둥근 폴리라인 → path d
  function toPath(pts, r) {
    r = r == null ? 10 : r;
    if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i - 1], c = pts[i], n = pts[i + 1];
      const l1 = Math.hypot(c.x - p.x, c.y - p.y), l2 = Math.hypot(n.x - c.x, n.y - c.y);
      const rr = Math.min(r, l1 / 2, l2 / 2);
      const a = { x: c.x - (c.x - p.x) / l1 * rr, y: c.y - (c.y - p.y) / l1 * rr };
      const b = { x: c.x + (n.x - c.x) / l2 * rr, y: c.y + (n.y - c.y) / l2 * rr };
      d += ` L${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`;
    }
    const last = pts[pts.length - 1];
    d += ` L${last.x},${last.y}`;
    return d;
  }

  // 경로 위 비율 t 지점 (직선 기준)
  function pointAt(pts, t) {
    const segs = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); segs.push(l); total += l; }
    let dist = total * t;
    for (let i = 0; i < segs.length; i++) {
      if (dist <= segs[i] || i === segs.length - 1) {
        const k = segs[i] === 0 ? 0 : dist / segs[i];
        return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
      }
      dist -= segs[i];
    }
    return pts[0];
  }

  // 라벨 기본 위치: 가장 긴 세그먼트의 중점
  function labelPoint(pts, e) {
    if (e.lat != null) return pointAt(pts, e.lat);
    let best = 0, bi = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); if (l > best) { best = l; bi = i; } }
    return { x: (pts[bi].x + pts[bi + 1].x) / 2, y: (pts[bi].y + pts[bi + 1].y) / 2 };
  }

  function el(name, attrs) { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }

  function markers(svg) {
    const defs = el('defs', {});
    const colors = { '': '#475569', dash: '#94a3b8', blue: '#1d4ed8', green: '#047857', orange: '#c2410c', violet: '#6d28d9' };
    for (const k in colors) {
      for (const dir of ['end', 'start']) {
        const m = el('marker', { id: `arr-${dir}${k ? '-' + k : ''}`, viewBox: '0 0 10 10', refX: dir === 'end' ? 9 : 1, refY: 5, markerWidth: 7, markerHeight: 7, orient: dir === 'end' ? 'auto' : 'auto-start-reverse' });
        m.appendChild(el('path', { d: 'M1,1 L9,5 L1,9 Z', fill: colors[k], stroke: colors[k], 'stroke-width': 1, 'stroke-linejoin': 'round' }));
        defs.appendChild(m);
      }
    }
    svg.appendChild(defs);
  }

  window.drawEdges = function (edges) {
    const stage = document.querySelector('.stage');
    let svg = stage.querySelector('svg.edges');
    if (svg) svg.remove();
    svg = el('svg', { class: 'edges', viewBox: '0 0 1920 1080' });
    markers(svg);
    stage.appendChild(svg);
    const labels = [];
    edges.forEach(e => {
      const r0 = rectOf(e.from), r1 = rectOf(e.to);
      const p0 = port(r0, e.fs || 'right', e.fa), p1 = port(r1, e.ts || 'left', e.ta);
      const pts = route(p0, p1, e);
      const cls = ['e', e.dash ? 'dash' : '', e.cls || '', e.thin ? 'thin' : ''].filter(Boolean).join(' ');
      const mk = e.dash ? 'dash' : (e.cls || '');
      const path = el('path', { class: cls, d: toPath(pts, e.r) });
      path.setAttribute('marker-end', `url(#arr-end${mk ? '-' + mk : ''})`);
      if (e.both) path.setAttribute('marker-start', `url(#arr-start${mk ? '-' + mk : ''})`);
      svg.appendChild(path);
      if (e.label) labels.push({ e, pt: labelPoint(pts, e) });
    });
    labels.forEach(({ e, pt }) => {
      const g = el('g', { class: 'lbl' + (e.mono ? ' mono' : '') });
      const off = e.loff || [0, 0];
      const lines = String(e.label).split('\n');
      const t = el('text', { x: pt.x + off[0], y: pt.y + off[1] });
      lines.forEach((ln, i) => {
        const ts = el('tspan', { x: pt.x + off[0], dy: i === 0 ? (-(lines.length - 1) * 9) : 18 });
        ts.textContent = ln; t.appendChild(ts);
      });
      const bg = el('rect', {});
      g.appendChild(bg); g.appendChild(t); svg.appendChild(g);
      const bb = t.getBBox();
      bg.setAttribute('x', bb.x - 8); bg.setAttribute('y', bb.y - 4);
      bg.setAttribute('width', bb.width + 16); bg.setAttribute('height', bb.height + 8);
    });
  };

  function fit() {
    const stage = document.querySelector('.stage'), wrap = document.querySelector('.wrap');
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `scale(${s})`;
    wrap.style.width = (1920 * s) + 'px'; wrap.style.height = (1080 * s) + 'px';
    wrap.style.margin = 'auto';
    wrap.style.position = 'absolute'; wrap.style.inset = '0';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('load', () => {
    fit();
    if (window.EDGES) window.drawEdges(window.EDGES);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (window.EDGES) window.drawEdges(window.EDGES); });
  });
})();
