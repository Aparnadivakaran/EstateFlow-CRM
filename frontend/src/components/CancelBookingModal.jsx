import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { useForm } from "../hooks.js";
import { Button, Field, Modal } from "./ui.jsx";

export default function CancelBookingModal({ booking, onClose, onCancelled }) {
  const { toast } = useApp();
  const qc = useQueryClient();
  const f = useForm({ reason: "" });
  const cancel = useMutation({ mutationFn: (reason) => api.cancelBooking(booking.id, reason) });
  const submit = f.submit(async (v) => {
    await cancel.mutateAsync(v.reason.trim());
    await qc.invalidateQueries();
    toast("Booking cancelled. The unit is available again.");
    onCancelled();
  });
  return (
    <Modal title="Cancel booking" onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Keep booking</Button>
        <Button variant="danger" loading={f.saving} disabled={f.values.reason.trim().length < 3} onClick={submit}>Cancel booking</Button>
      </>}>
      <div className="stack">
        <div className="alert info">
          Unit <b>{booking.unit.unit_number}</b> ({booking.project_name} · {booking.building_name}) will go back on sale
          and <b>{booking.lead.name}</b> returns to Negotiation.
        </div>
        {f.formError && <div className="alert error" role="alert">{f.formError}</div>}
        <Field label="Reason" required>
          <input value={f.values.reason} onChange={f.set("reason")} placeholder="e.g. Loan not approved" autoFocus />
        </Field>
      </div>
    </Modal>
  );
}
