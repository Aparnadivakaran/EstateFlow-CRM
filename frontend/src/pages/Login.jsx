import { useState } from "react";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { useForm } from "../hooks.js";
import { Button, Field, Icon } from "../components/ui.jsx";

export default function Login() {
  const [mode, setMode] = useState("signin");   // "signin" | "signup"
  return (
    <div className="login">
      <section className="login-art">
        <div className="row">
          <span className="avatar" style={{ background: "rgba(255,255,255,.2)" }}><Icon name="building" /></span>
          <b style={{ fontSize: 18 }}>EstateFlow</b>
        </div>
        <h1>Close more deals,<br />miss fewer follow-ups.</h1>
        <p>One place for your leads, inventory and bookings — so no unit is ever sold twice. Every company gets its own private workspace.</p>
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
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Sign in</h2>
      <p className="muted" style={{ margin: "0 0 18px" }}>Use your work email to continue.</p>
      <div className="stack">
        {f.formError && <div className="alert error" role="alert">{f.formError}</div>}
        <Field label="Email">
          <input type="email" autoComplete="username" autoFocus value={f.values.email} onChange={f.set("email")} placeholder="you@company.com" required />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete="current-password" value={f.values.password} onChange={f.set("password")} required />
        </Field>
        <Button variant="primary" type="submit" loading={f.saving}>Sign in</Button>
      </div>
      <p className="small" style={{ margin: "14px 0 0", textAlign: "center" }}>
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
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Create your workspace</h2>
      <p className="muted" style={{ margin: "0 0 18px" }}>You'll be the admin. Add your sales team after signing up.</p>
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
      <p className="small" style={{ margin: "14px 0 0", textAlign: "center" }}>
        Already have an account? <button type="button" className="linklike" onClick={onSwitch}>Sign in</button>
      </p>
    </form>
  );
}
