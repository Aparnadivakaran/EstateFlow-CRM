// Small reusable building blocks. Pages are assembled from these.
import { useEffect } from "react";
import { slug } from "../utils.js";

const paths = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  leads: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  building: "M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 13v.01M9 17v.01",
  booking: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 16l2 2 4-4",
  team: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM3 22a9 9 0 0 1 18 0",
  search: "M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14",
  menu: "M3 6h18M3 12h18M3 18h18",
  x: "M18 6L6 18M6 6l12 12",
  back: "M15 18l-6-6 6-6",
  plus: "M12 5v14M5 12h14",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  trendUp: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  trendDown: "M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M19 12l-7 7-7-7",
  rupee: "M6 3h12M6 8h12M6 13l8.5 8M6 13h3M9 13c6.667 0 6.667-10 0-10",
  cube: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7L12 12l8.7-5M12 22V12",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  pin: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  check: "M20 6L9 17l-5-5",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};

// Soft, deterministic avatar colours (same name -> same colour everywhere)
const AVATAR_COLORS = [["#e0eaff", "#2f55d4"], ["#ffe9d5", "#c4501b"], ["#dcfae6", "#087443"], ["#fce7f6", "#c11574"],
  ["#ece9fe", "#5925dc"], ["#cffafe", "#0e7090"], ["#fef0c7", "#b54708"], ["#ffe4e8", "#c01048"]];
export const colorFor = (s = "") => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initialsOf = (name = "") => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function Avatar({ name = "", size = "" }) {
  const [bg, fg] = colorFor(name);
  return <span className={"avatar " + size} style={{ background: bg, color: fg }} aria-hidden="true">{initialsOf(name) || "?"}</span>;
}

export const Progress = ({ value, tone = "" }) => (
  <div className={"progress " + tone}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
);

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map(([v, label]) => (
      <button key={v} role="tab" aria-selected={value === v} className={"tab " + (value === v ? "on" : "")} onClick={() => onChange(v)}>{label}</button>
    ))}
  </div>
);

export const Icon = ({ name }) => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name]} />
  </svg>
);

export const Badge = ({ value, label }) => <span className={"badge " + slug(value)}>{label || value}</span>;

export function Button({ variant = "", size = "", loading, children, ...rest }) {
  return (
    <button className={`btn ${variant} ${size}`} {...rest} disabled={loading || rest.disabled}>
      {loading && <span className="spinner" style={{ width: 14, height: 14 }} />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, full, required }) {
  return (
    <div className={`field ${error ? "invalid" : ""} ${full ? "full" : ""}`}>
      <label>{label}{required && <span style={{ color: "var(--red)" }}> *</span>}</label>
      {children}
      {error ? <span className="err" role="alert">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 720 } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const Empty = ({ icon = "📭", title, text, action }) => (
  <div className="empty">
    <div className="big">{icon}</div><b>{title}</b><div>{text}</div>
    {action && <div style={{ marginTop: 14 }}>{action}</div>}
  </div>
);

export const ErrorState = ({ error, onRetry }) => (
  <div className="empty">
    <div className="big">⚠️</div><b>Couldn't load this</b><div>{error?.message || "Unexpected error"}</div>
    {onRetry && <div style={{ marginTop: 14 }}><Button onClick={onRetry}>Try again</Button></div>}
  </div>
);

export const Loading = () => <div className="empty"><span className="spinner" /></div>;

export const SkeletonRows = ({ rows = 5, cols = 4 }) => (
  <div style={{ padding: "8px 18px" }}>
    {Array.from({ length: rows }, (_, r) => (
      <div key={r} className="row" style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
        {Array.from({ length: cols }, (_, i) => <div key={i} className="skel grow" style={{ maxWidth: i ? 120 : 220 }} />)}
      </div>
    ))}
  </div>
);

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  return (
    <div className="pager">
      <span className="muted small">Showing {from}–{Math.min(page * pageSize, total)} of {total}</span>
      <div className="row">
        <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        <span className="small muted">Page {page} of {pages}</span>
        <Button size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export const PageHead = ({ title, subtitle, children }) => (
  <div className="page-head">
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    <div className="row wrap">{children}</div>
  </div>
);
