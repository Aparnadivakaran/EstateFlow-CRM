// Create / edit lead form, used from the Leads list and the Lead detail page.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { useForm } from "../hooks.js";
import { Button, Field, Modal } from "./ui.jsx";
import { SOURCES } from "../utils.js";

export default function LeadForm({ lead, onClose, onSaved }) {
  const { user, toast } = useApp();
  const qc = useQueryClient();
  const isAdmin = user.role === "admin";
  const editing = !!lead;
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: api.users, enabled: isAdmin });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const f = useForm({
    name: lead?.name || "", phone: lead?.phone || "", email: lead?.email || "", source: lead?.source || "",
    budget: lead?.budget ?? "", interested_project_id: lead?.interested_project?.id || "",
    assigned_to_id: lead?.assigned_to_id || "", next_follow_up: lead?.next_follow_up || "",
  });
  const v = f.values;

  const save = useMutation({
    mutationFn: (body) => (editing ? api.updateLead(lead.id, body) : api.createLead(body)),
  });

  const submit = f.submit(async () => {
    const body = {
      name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim() || null, source: v.source || null,
      budget: v.budget === "" ? null : Number(v.budget),
      interested_project_id: v.interested_project_id ? Number(v.interested_project_id) : null,
      next_follow_up: v.next_follow_up || null,
    };
    if (isAdmin) body.assigned_to_id = v.assigned_to_id ? Number(v.assigned_to_id) : null;
    const saved = await save.mutateAsync(body);
    await qc.invalidateQueries();
    toast(editing ? "Lead updated" : "Lead created");
    onSaved(saved);
  });

  return (
    <Modal title={editing ? "Edit lead" : "New lead"} onClose={onClose} wide
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={f.saving} onClick={submit}>{editing ? "Save changes" : "Create lead"}</Button>
      </>}>
      <form onSubmit={submit} noValidate>
        {f.formError && !Object.keys(f.errors).length && <div className="alert error" role="alert" style={{ marginBottom: 14 }}>{f.formError}</div>}
        <div className="form-grid">
          <Field label="Full name" required error={f.errors.name}><input value={v.name} onChange={f.set("name")} autoFocus /></Field>
          <Field label="Phone" required error={f.errors.phone} hint="Used to detect duplicate leads"><input type="tel" value={v.phone} onChange={f.set("phone")} placeholder="+91 98765 43210" /></Field>
          <Field label="Email" error={f.errors.email}><input type="email" value={v.email} onChange={f.set("email")} /></Field>
          <Field label="Source">
            <select value={v.source} onChange={f.set("source")}><option value="">—</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Budget (₹)" error={f.errors.budget}><input type="number" min="0" step="100000" value={v.budget} onChange={f.set("budget")} placeholder="e.g. 8000000" /></Field>
          <Field label="Interested project">
            <select value={v.interested_project_id} onChange={f.set("interested_project_id")}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </Field>
          {isAdmin ? (
            <Field label="Assigned to">
              <select value={v.assigned_to_id} onChange={f.set("assigned_to_id")}>
                <option value="">Unassigned</option>{users.filter((u) => u.is_active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Assigned to"><input value={editing ? lead.assigned_to?.name || "—" : user.name + " (you)"} disabled readOnly /></Field>
          )}
          <Field label="Next follow-up"><input type="date" value={v.next_follow_up} onChange={f.set("next_follow_up")} /></Field>
        </div>
      </form>
    </Modal>
  );
}
