import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { useForm } from "../hooks.js";
import { Badge, Button, ErrorState, Field, Icon, Loading, Modal } from "../components/ui.jsx";
import LeadForm from "../components/LeadForm.jsx";
import BookUnitModal from "../components/BookUnitModal.jsx";
import CancelBookingModal from "../components/CancelBookingModal.jsx";
import { fmtDate, fmtDateTime, followState, moneyFull, STAGES, todayISO } from "../utils.js";

export default function LeadDetail() {
  const id = Number(useParams().id);
  const { user, toast } = useApp();
  const qc = useQueryClient();
  const { data: lead, error, refetch, isFetching } = useQuery({ queryKey: ["lead", id], queryFn: () => api.lead(id) });
  const { data: bookings = [] } = useQuery({ queryKey: ["bookings", { lead_id: id }], queryFn: () => api.bookings({ lead_id: id }) });
  const [modal, setModal] = useState(null);   // "edit" | "book" | {cancel: booking} | {lost: true}
  const note = useForm({ body: "", next_follow_up: "" });

  const stageMutation = useMutation({
    mutationFn: (body) => api.updateLead(id, body),
    onSuccess: (_, body) => { toast(`Stage: ${body.stage}`); setModal(null); qc.invalidateQueries(); },
    onError: (e) => toast(e.message, "error"),
  });

  if (error) {
    return (
      <>
        <Link className="back" to="/leads"><Icon name="back" /> Leads</Link>
        <div className="card"><ErrorState error={error} onRetry={refetch} /></div>
      </>
    );
  }
  if (!lead) return <Loading />;

  const hasActiveBooking = bookings.some((b) => b.status === "active");
  const st = followState(lead.next_follow_up, lead.stage);
  const busy = stageMutation.isPending;

  const addNote = note.submit(async (v) => {
    await api.addNote(id, { body: v.body, next_follow_up: v.next_follow_up || null });
    note.setValues({ body: "", next_follow_up: "" });
    toast("Note added");
    qc.invalidateQueries();
  });

  return (
    <>
      <Link className="back" to="/leads"><Icon name="back" /> Leads</Link>
      <div className="page-head">
        <div>
          <div className="row wrap"><h1>{lead.name}</h1><Badge value={lead.stage} /></div>
          <p>{lead.phone}{lead.assigned_to ? " · Owner: " + lead.assigned_to.name : ""}</p>
        </div>
        <div className="row wrap">
          <Button onClick={() => setModal("edit")}>Edit</Button>
          {lead.stage !== "Lost" && <Button variant="primary" onClick={() => setModal("book")}>Book a unit</Button>}
        </div>
      </div>

      <div className="detail-grid" style={{ opacity: isFetching ? 0.7 : 1 }}>
        <div className="stack">
          <section className="card card-pad">
            <h2 style={{ marginBottom: 12 }}>Details</h2>
            <dl className="kv">
              <dt>Phone</dt><dd><a href={"tel:" + lead.phone}>{lead.phone}</a></dd>
              <dt>Email</dt><dd>{lead.email ? <a href={"mailto:" + lead.email}>{lead.email}</a> : "—"}</dd>
              <dt>Source</dt><dd>{lead.source || "—"}</dd>
              <dt>Budget</dt><dd>{moneyFull(lead.budget)}</dd>
              <dt>Interested in</dt><dd>{lead.interested_project?.name || "—"}</dd>
              <dt>Assigned to</dt><dd>{lead.assigned_to?.name || <span className="muted">Unassigned</span>}</dd>
              <dt>Follow-up</dt>
              <dd className={st === "overdue" ? "late" : st === "today" ? "today" : ""}>
                {lead.next_follow_up ? fmtDate(lead.next_follow_up) + (st === "overdue" ? " (overdue)" : st === "today" ? " (today)" : "") : "—"}
              </dd>
              <dt>Created</dt><dd>{fmtDate(lead.created_at)}</dd>
              {lead.lost_reason && <><dt>Lost reason</dt><dd>{lead.lost_reason}</dd></>}
            </dl>
          </section>

          {bookings.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>Bookings</h2></div>
              {bookings.map((b) => (
                <div className="list-item" key={b.id}>
                  <div>
                    <div className="cell-main">{b.project_name} · {b.building_name} · Unit {b.unit.unit_number}</div>
                    <div className="cell-sub">
                      {moneyFull(b.agreed_price)} · token {moneyFull(b.token_amount)} · {fmtDate(b.created_at)}{b.cancel_reason ? " · " + b.cancel_reason : ""}
                    </div>
                  </div>
                  <div className="row">
                    <Badge value={b.status} />
                    {b.status === "active" && (user.role === "admin" || b.booked_by.id === user.id) &&
                      <Button size="sm" variant="danger" onClick={() => setModal({ cancel: b })}>Cancel</Button>}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>

        <div className="stack">
          <section className="card card-pad">
            <h2 style={{ marginBottom: 10 }}>Stage</h2>
            <div className="stage-track">
              {STAGES.map((s) => (
                <button key={s} className={lead.stage === s ? "on" : ""} disabled={busy || s === "Booked" || hasActiveBooking}
                  title={s === "Booked" ? "Use “Book a unit” to move a lead to Booked" : hasActiveBooking ? "Cancel the booking first" : ""}
                  onClick={() => lead.stage !== s && (s === "Lost" ? setModal({ lost: true }) : stageMutation.mutate({ stage: s }))}>
                  {s}
                </button>
              ))}
            </div>
            {lead.stage === "Lost" && <p className="small muted" style={{ margin: "10px 0 0" }}>Reason: {lead.lost_reason}. Pick another stage to reopen this lead.</p>}
          </section>

          <section className="card card-pad">
            <h2 style={{ marginBottom: 10 }}>Add a note</h2>
            <form onSubmit={addNote} className="stack">
              {note.formError && <div className="alert error" role="alert">{note.formError}</div>}
              <textarea placeholder="What happened? e.g. Called, wants a site visit on Saturday…" value={note.values.body} onChange={note.set("body")} aria-label="Note" />
              <div className="row wrap">
                <Field label="Next follow-up (optional)">
                  <input type="date" min={todayISO()} value={note.values.next_follow_up} onChange={note.set("next_follow_up")} />
                </Field>
                <div className="grow" />
                <Button variant="primary" type="submit" loading={note.saving} disabled={!note.values.body.trim()}>Save note</Button>
              </div>
            </form>
          </section>

          <section className="card card-pad">
            <h2 style={{ marginBottom: 12 }}>Activity</h2>
            <ul className="timeline">
              {lead.notes.map((n) => (
                <li key={n.id} className={n.kind}>
                  <div className="small muted">{n.author?.name || "System"} · {fmtDateTime(n.created_at)}</div>
                  <div className={"body " + (n.kind === "system" ? "sys" : "")}>{n.body}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {modal === "edit" && <LeadForm lead={lead} onClose={() => setModal(null)} onSaved={() => setModal(null)} />}
      {modal === "book" && <BookUnitModal lead={lead} onClose={() => setModal(null)} onBooked={() => setModal(null)} />}
      {modal?.cancel && <CancelBookingModal booking={modal.cancel} onClose={() => setModal(null)} onCancelled={() => setModal(null)} />}
      {modal?.lost && <LostModal busy={busy} onClose={() => setModal(null)} onConfirm={(reason) => stageMutation.mutate({ stage: "Lost", lost_reason: reason })} />}
    </>
  );
}

function LostModal({ onClose, onConfirm, busy }) {
  const [reason, setReason] = useState("");
  const reasons = ["Budget mismatch", "Bought elsewhere", "Not interested", "Unreachable", "Location not suitable"];
  return (
    <Modal title="Mark lead as Lost" onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>Mark as Lost</Button>
      </>}>
      <div className="stack">
        <Field label="Why was this lead lost?" required><input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        <div className="chips">
          {reasons.map((r) => <button key={r} type="button" className={"chip " + (reason === r ? "on" : "")} onClick={() => setReason(r)}>{r}</button>)}
        </div>
      </div>
    </Modal>
  );
}
