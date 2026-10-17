// Booking flow: pick project -> pick an available unit -> confirm token amount.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { useForm } from "../hooks.js";
import { Button, Empty, Field, Loading, Modal } from "./ui.jsx";
import { moneyFull } from "../utils.js";

export default function BookUnitModal({ lead, onClose, onBooked }) {
  const { toast } = useApp();
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const [projectId, setProjectId] = useState(lead.interested_project?.id || "");
  const [unitId, setUnitId] = useState("");
  const { data: project, isLoading, refetch } = useQuery({
    queryKey: ["project", String(projectId)],
    queryFn: () => api.project(projectId),
    enabled: !!projectId,
    staleTime: 0,                    // always fetch fresh availability when the modal opens
  });
  const f = useForm({ token_amount: "", notes: "" });
  const book = useMutation({ mutationFn: api.createBooking });

  const units = project
    ? project.buildings.flatMap((b) => b.units.filter((u) => u.status === "available").map((u) => ({ ...u, building: b.name })))
    : [];
  const selected = units.find((u) => u.id === Number(unitId));

  const submit = f.submit(async (v) => {
    if (!selected) throw new Error("Choose a unit to book");
    try {
      const b = await book.mutateAsync({ lead_id: lead.id, unit_id: selected.id, token_amount: Number(v.token_amount || 0), notes: v.notes || null });
      await qc.invalidateQueries();
      toast("Unit booked 🎉");
      onBooked(b);
    } catch (err) {
      if (err.status === 409) { setUnitId(""); refetch(); }   // someone else got it: refresh so it disappears from the list
      throw err;
    }
  });

  return (
    <Modal title={"Book a unit for " + lead.name} onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={f.saving} disabled={!selected} onClick={submit}>Confirm booking</Button>
      </>}>
      <div className="stack">
        {f.formError && <div className="alert error" role="alert">{f.formError}</div>}
        <Field label="Project">
          <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setUnitId(""); }}>
            <option value="">Select a project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.available} available</option>)}
          </select>
        </Field>
        {projectId && (isLoading ? <Loading /> : units.length === 0
          ? <Empty icon="🏗️" title="No units available" text="Every unit in this project is booked or blocked." />
          : (
            <Field label="Unit">
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">Select a unit…</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.building} · {u.unit_number} · {u.type} · {u.area_sqft} sqft · {moneyFull(u.price)}</option>)}
              </select>
            </Field>
          ))}
        {selected && (
          <>
            <div className="alert info">Price: <b>{moneyFull(selected.price)}</b> · Floor {selected.floor} · {selected.type}</div>
            <Field label="Token amount (₹)" hint="Amount received to hold the unit (optional)">
              <input type="number" min="0" max={selected.price} value={f.values.token_amount} onChange={f.set("token_amount")} />
            </Field>
            <Field label="Notes">
              <textarea value={f.values.notes} onChange={f.set("notes")} placeholder="Payment mode, cheque no., special terms…" />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
