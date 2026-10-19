import { useState } from "react";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { useForm } from "../hooks.js";
import { Button, Field, Icon } from "../components/ui.jsx";

const BARS = [38, 52, 44, 70, 58, 86, 64];   // decorative preview only

export default function Login() {
  const [mode, setMode] = useState("signin");   // "signin" | "signup"
  return (
    <div className="login">
      <section className="login-art">
        <div className="brand"><span className="logo"><Icon name="building" /></span> EstateFlow</div>
        <div>
          <h1>Close more deals,<br />miss fewer follow-ups.</h1>
          <p>One place for your leads, inventory and bookings — so no unit is ever sold twice. Every company gets its own private workspace.</p>
        </div>
        <div className="preview" aria-hidden="true">
          <div className="pv-kpis">
            <div className="pv-k blue"><span>Booked value</span><b>₹4.8 Cr</b></div>
            <div className="pv-k"><span>New leads</span><b>128</b></div>
            <div className="pv-k"><span>Bookings</span><b>24</b></div>
          </div>
          <div className="pv-bars">{BARS.map((h, i) => <i key={i} className={i === 5 ? "hi" : ""} style={{ height: `${h}%` }} />)}</div>
        </div>
      </section>
      <section className="login-form">
        {mode === "signin" ? <SignIn onSwitch={() => setMode("signup")} /> : <SignUp onSwitch={() => setMode("signin")} />}
      </section>
    </div>
  );
}

function SignIn({ onSwitch }) {
  const { login } = useApp();
  const f = useForm({ email: "", password: "" });
  const submit = f.submit(async (v) => login(await api.login(v.email, v.password)));
  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Welcome back</h2>
      <p className="muted" style={{ margin: "4px 0 22px" }}>Sign in with your work email to continue.</p>
      <div className="stack">
        {f.formError && <div className="alert error" role="alert">{f.formError}</div>}
        <Field label="Email">
          <input type="email" autoComplete="username" autoFocus value={f.values.email} onChange={f.set("email")} placeholder="you@company.com" required />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete="current-password" value={f.values.password} onChange={f.set("password")} placeholder="••••••••" required />
        </Field>
        <Button variant="primary" type="submit" loading={f.saving}>Sign in</Button>
      </div>
      <p className="small" style={{ margin: "18px 0 0", textAlign: "center" }}>
        New here? <button type="button" className="linklike" onClick={onSwitch}>Create your company workspace</button>
      </p>
    </form>
  );
}

function SignUp({ onSwitch }) {
  const { login } = useApp();
  const f = useForm({ company_name: "", name: "", email: "", password: "" });
  const submit = f.submit(async (v) => login(await api.signup({ ...v, company_name: v.company_name.trim(), name: v.name.trim() })));
  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Create your workspace</h2>
      <p className="muted" style={{ margin: "4px 0 22px" }}>You'll be the admin. Add your sales team after signing up.</p>
      <div className="stack">
        {f.formError && !Object.keys(f.errors).length && <div className="alert error" role="alert">{f.formError}</div>}
        <Field label="Company name" required error={f.errors.company_name}>
          <input autoFocus value={f.values.company_name} onChange={f.set("company_name")} placeholder="Acme Realty" />
        </Field>
        <Field label="Your name" required error={f.errors.name}>
          <input autoComplete="name" value={f.values.name} onChange={f.set("name")} />
        </Field>
        <Field label="Work email" required error={f.errors.email}>
          <input type="email" autoComplete="username" value={f.values.email} onChange={f.set("email")} placeholder="you@company.com" />
        </Field>
        <Field label="Password" required error={f.errors.password} hint="At least 8 characters">
          <input type="password" autoComplete="new-password" value={f.values.password} onChange={f.set("password")} />
        </Field>
        <Button variant="primary" type="submit" loading={f.saving}>Create workspace</Button>
      </div>
      <p className="small" style={{ margin: "18px 0 0", textAlign: "center" }}>
        Already have an account? <button type="button" className="linklike" onClick={onSwitch}>Sign in</button>
      </p>
    </form>
  );
}
