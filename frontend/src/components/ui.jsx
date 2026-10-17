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
};

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
