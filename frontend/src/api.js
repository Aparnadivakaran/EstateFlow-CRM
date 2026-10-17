// All network calls go through request() so token handling and error shape live in ONE place.
const TOKEN_KEY = "crm_token";

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },
};

export class ApiError extends Error {
  constructor(message, status, fields = {}) { super(message); this.status = status; this.fields = fields; }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch("/api" + path, {
      method,
      headers: { "Content-Type": "application/json", ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") window.dispatchEvent(new Event("crm:logout"));
    const detail = typeof data.detail === "string" ? data.detail : "Something went wrong. Please try again.";
    throw new ApiError(detail, res.status, data.fields || {});
  }
  return data;
}

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== "" && v != null) p.set(k, v); });
  const s = p.toString();
  return s ? "?" + s : "";
};

export const api = {
  login: (email, password) => request("POST", "/auth/login", { email, password }),
  signup: (body) => request("POST", "/auth/signup", body),
  me: () => request("GET", "/auth/me"),
  users: () => request("GET", "/users"),
  createUser: (b) => request("POST", "/users", b),
  updateUser: (id, b) => request("PATCH", `/users/${id}`, b),
  dashboard: () => request("GET", "/dashboard"),
  leads: (params) => request("GET", "/leads" + qs(params)),
  lead: (id) => request("GET", `/leads/${id}`),
  createLead: (b) => request("POST", "/leads", b),
  updateLead: (id, b) => request("PATCH", `/leads/${id}`, b),
  addNote: (id, b) => request("POST", `/leads/${id}/notes`, b),
  projects: () => request("GET", "/properties/projects"),
  project: (id) => request("GET", `/properties/projects/${id}`),
  createProject: (b) => request("POST", "/properties/projects", b),
  deleteProject: (id) => request("DELETE", `/properties/projects/${id}`),
  createBuilding: (pid, b) => request("POST", `/properties/projects/${pid}/buildings`, b),
  createUnit: (bid, b) => request("POST", `/properties/buildings/${bid}/units`, b),
  updateUnit: (id, b) => request("PATCH", `/properties/units/${id}`, b),
  deleteUnit: (id) => request("DELETE", `/properties/units/${id}`),
  bookings: (params) => request("GET", "/bookings" + qs(params)),
  createBooking: (b) => request("POST", "/bookings", b),
  cancelBooking: (id, reason) => request("POST", `/bookings/${id}/cancel`, { reason }),
};
