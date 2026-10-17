export const STAGES = ["New", "Contacted", "Site Visit", "Interested", "Negotiation", "Booked", "Lost"];
export const UNIT_TYPES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Villa", "Plot", "Shop", "Office"];
export const SOURCES = ["Website", "Referral", "Walk-in", "Facebook Ads", "99acres", "Broker", "Other"];

// Indian-style formatting: 1,20,00,000 -> "₹1.20 Cr"
export function money(n) {
  if (n == null) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
export const moneyFull = (n) => (n == null ? "—" : "₹" + Math.round(n).toLocaleString("en-IN"));

const iso = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s + "Z");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
export function fmtDateTime(s) {
  const d = new Date(s + "Z"); // server stores UTC
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
// "overdue" | "today" | "later" | null  (for colouring follow-up dates)
export function followState(dateStr, stage) {
  if (!dateStr || stage === "Booked" || stage === "Lost") return null;
  const t = todayISO();
  return dateStr < t ? "overdue" : dateStr === t ? "today" : "later";
}
export const initials = (name = "") => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
export const slug = (s) => s.replace(/\s+/g, "-");
export const debounceValue = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
