import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { useForm } from "../hooks.js";
import { Badge, Button, ErrorState, Field, Icon, Modal, PageHead, SkeletonRows } from "../components/ui.jsx";

export default function Team() {
  const { user, toast } = useApp();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["users"], queryFn: api.users });
  const [adding, setAdding] = useState(false);

  const toggle = async (u) => {
    try {
      await api.updateUser(u.id, { is_active: !u.is_active });
      toast(u.is_active ? `${u.name} deactivated` : `${u.name} reactivated`);
      qc.invalidateQueries();
    } catch (e) { toast(e.message, "error"); }
  };

  return (
    <>
      <PageHead title="Team" subtitle="Manage who can sign in and what they can do.">
        <Button variant="primary" onClick={() => setAdding(true)}><Icon name="plus" /> Add employee</Button>
      </PageHead>
      <section className="card">
        {error ? <ErrorState error={error} onRetry={refetch} />
          : isLoading ? <SkeletonRows cols={4} />
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {data.map((u) => (
                    <tr key={u.id}>
                      <td><div className="cell-main">{u.name}{u.id === user.id ? " (you)" : ""}</div><div className="cell-sub">{u.email}</div></td>
                      <td><Badge value={u.role} label={u.role === "admin" ? "Admin" : "Sales"} /></td>
                      <td><Badge value={u.is_active ? "active" : "cancelled"} label={u.is_active ? "Active" : "Deactivated"} /></td>
                      <td className="right">{u.id !== user.id && <Button size="sm" onClick={() => toggle(u)}>{u.is_active ? "Deactivate" : "Reactivate"}</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
      {adding && <AddUser onClose={() => setAdding(false)} onSaved={() => { setAdding(false); qc.invalidateQueries(); }} />}
    </>
  );
}

function AddUser({ onClose, onSaved }) {
  const { toast } = useApp();
  const f = useForm({ name: "", email: "", password: "", role: "sales" });
  const save = f.submit(async (v) => { await api.createUser(v); toast("Employee added"); onSaved(); });
  return (
    <Modal title="Add employee" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={f.saving} onClick={save}>Add employee</Button></>}>
      <form className="stack" onSubmit={save} noValidate>
        {f.formError && !Object.keys(f.errors).length && <div className="alert error">{f.formError}</div>}
        <Field label="Full name" required error={f.errors.name}><input value={f.values.name} onChange={f.set("name")} autoFocus /></Field>
        <Field label="Email" required error={f.errors.email}><input type="email" value={f.values.email} onChange={f.set("email")} /></Field>
        <Field label="Temporary password" required error={f.errors.password} hint="At least 6 characters"><input type="text" value={f.values.password} onChange={f.set("password")} /></Field>
        <Field label="Role">
          <select value={f.values.role} onChange={f.set("role")}><option value="sales">Sales employee</option><option value="admin">Admin</option></select>
        </Field>
      </form>
    </Modal>
  );
}
