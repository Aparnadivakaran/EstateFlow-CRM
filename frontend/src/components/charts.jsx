// Small hand-built charts (no chart library): a hover-able bar chart and a segmented half-circle gauge.
import { useState } from "react";

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

/** data: [{label, ...}]  valueOf(d) -> number  ·  axis(v) -> text for the y-axis  ·  tip(d) -> [[label, value], ...] */
export function BarChart({ data, valueOf, axis, tip, title }) {
  const [hover, setHover] = useState(null);
  const active = hover ?? data.length - 1;               // default highlight: the latest month
  const max = niceMax(Math.max(...data.map(valueOf), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const hasData = data.some((d) => valueOf(d) > 0);
  return (
    <div className="chart" role="img" aria-label={title}>
      <div className="chart-y">{ticks.map((t) => <span key={t} style={{ bottom: `${t * 100}%` }}>{axis(max * t)}</span>)}</div>
      <div className="chart-plot">
        {ticks.map((t) => <div className="chart-line" key={t} style={{ bottom: `${t * 100}%` }} />)}
        <div className="chart-bars">
          {data.map((d, i) => {
            const pct = (valueOf(d) / max) * 100;
            const on = i === active;
            return (
              <div key={d.month} className={"bar-col " + (on ? "on" : "")} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
                <div className="bar-track" />
                <div className="bar-fill" style={{ height: `${pct}%` }}><span className="bar-dot" /></div>
                <span className="bar-x">{d.label}</span>
                {on && (
                  <div className={"tip " + (pct > 48 ? (i > data.length / 2 ? "side-l" : "side-r") : i === 0 ? "first" : i === data.length - 1 ? "last" : "")}
                    style={pct > 48 ? { top: 8 } : { bottom: `calc(${pct}% + 18px)` }}>
                    <b>{d.label} {d.month.slice(0, 4)}</b>
                    {tip(d).map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!hasData && <div className="empty" style={{ position: "absolute", inset: "0 0 30px 52px", paddingTop: 80 }}><b>No activity yet</b>Bookings will appear here as you make them.</div>}
    </div>
  );
}

/** Half-circle gauge made of N radial segments. pct: 0-100 */
export function Gauge({ pct, label, sub }) {
  const N = 14, cx = 150, cy = 140, R = 128, r = 84, gap = 0.035;
  const seg = Math.PI / N;
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * N;
  const pt = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  const paths = Array.from({ length: N }, (_, k) => {
    const a0 = Math.PI + k * seg + gap, a1 = Math.PI + (k + 1) * seg - gap;
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
    const d = `M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 0 0 ${x3} ${y3}Z`;
    const full = k + 1 <= filled, part = !full && k < filled;
    const t = k / (N - 1);
    const fill = full ? `hsl(${218 - t * 8} ${88 - t * 18}% ${46 + t * 28}%)` : part ? "#bcd3ff" : "#eef0f6";
    return <path key={k} d={d} fill={fill} stroke={fill} strokeWidth="5" strokeLinejoin="round" />;
  });
  return (
    <div className="gauge" role="img" aria-label={`${label}: ${pct}%`}>
      <svg viewBox="0 0 300 150">{paths}</svg>
      <div className="gauge-center"><b>{pct}%</b><span>{label}</span>{sub && <div className="small muted">{sub}</div>}</div>
    </div>
  );
}
