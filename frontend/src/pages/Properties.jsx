import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { useForm } from "../hooks.js";
import { Badge, Button, Empty, ErrorState, Field, Icon, Loading, Modal, PageHead } from "../components/ui.jsx";
import { moneyFull, money, UNIT_TYPES } from "../utils.js";

/* ---------- Projects list ---------- */
export function Properties() {
  const { user } = useApp();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const [creating, setCreating] = useState(false);
  const admin = user.role === "admin";

  return (
    <>
      <PageHead title="Properties" subtitle="Projects, buildings and units available for sale.">
        {admin && <Button variant="primary" onClick={() => setCreating(true)}><Icon name="plus" /> New project</Button>}
      </PageHead>
      {error ? <div className="card"><ErrorState error={error} onRetry={refetch} /></div>
        : isLoading ? (
          <div className="proj-grid">
            {[1, 2, 3].map((i) => (
              <div className="card proj-card" key={i}><div className="skel" style={{ width: "60%", height: 18 }} /><div className="skel" /><div className="skel" style={{ width: "80%" }} /></div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="card"><Empty icon="🏗️" title="No projects yet" text={admin ? "Create a project, then add buildings and units." : "An admin needs to add projects first."} /></div>
        ) : (
          <div className="proj-grid">
            {data.map((p) => (
              <Link className="card proj-card" to={"/properties/" + p.id} key={p.id}>
                <div><h2>{p.name}</h2><div className="muted small">📍 {p.location}</div></div>
                <div className="meter" title="Green = available, blue = booked">
                  <i className="a" style={{ width: `${p.total_units ? (p.available / p.total_units) * 100 : 0}%` }} />
                  <i className="b" style={{ width: `${p.total_units ? (p.booked / p.total_units) * 100 : 0}%` }} />
                </div>
                <div className="row spread small">
                  <span><b>{p.available}</b> available</span><span><b>{p.booked}</b> booked</span>
                  <span className="muted">{p.total_units} units · {p.buildings} bldg</span>
                </div>
                <div className="cell-main">
                  {p.min_price ? (p.min_price === p.max_price ? money(p.min_price) : `${money(p.min_price)} – ${money(p.max_price)}`) : "No units yet"}
                </div>
              </Link>
            ))}
          </div>
        )}
      {creating && <ProjectForm onClose={() => setCreating(false)} onSaved={(p) => { setCreating(false); navigate("/properties/" + p.id); }} />}
    </>
  );
}

function ProjectForm({ onClose, onSaved }) {
  const { toast } = useApp();
  const qc = useQueryClient();
  const f = useForm({ name: "", location: "", description: "" });
  const save = f.submit(async (v) => {
    const p = await api.createProject(v);
    await qc.invalidateQueries();
    toast("Project created");
    onSaved(p);
  });
  return (
    <Modal title="New project" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={f.saving} onClick={save}>Create project</Button></>}>
      <form className="stack" onSubmit={save}>
        {f.formError && !Object.keys(f.errors).length && <div className="alert error">{f.formError}</div>}
        <Field label="Project name" required error={f.errors.name}><input value={f.values.name} onChange={f.set("name")} autoFocus /></Field>
        <Field label="Location" required error={f.errors.location}><input value={f.values.location} onChange={f.set("location")} placeholder="Area, City" /></Field>
        <Field label="Description"><textarea value={f.values.description} onChange={f.set("description")} /></Field>
      </form>
    </Modal>
  );
}

/* ---------- Project detail: buildings + unit grid ---------- */
export function ProjectDetail() {
  const id = Number(useParams().id);
  const { user, toast } = useApp();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const admin = user.role === "admin";
  const { data: p, error, refetch } = useQuery({ queryKey: ["project", String(id)], queryFn: () => api.project(id) });
  const [modal, setModal] = useState(null);   // {building:true} | {unit: building} | {edit: unit}
  const [filter, setFilter] = useState("all");

  if (error) {
    return (
      <>
        <Link className="back" to="/properties"><Icon name="back" /> Properties</Link>
        <div className="card"><ErrorState error={error} onRetry={refetch} /></div>
      </>
    );
  }
  if (!p) return <Loading />;

  const done = () => { setModal(null); qc.invalidateQueries(); };
  const remove = async () => {
    if (!window.confirm(`Delete "${p.name}" and all its buildings and units? This can't be undone.`)) return;
    try { await api.deleteProject(p.id); toast("Project deleted"); qc.invalidateQueries(); navigate("/properties"); }
    catch (e) { toast(e.message, "error"); }
  };

  return (
    <>
      <Link className="back" to="/properties"><Icon name="back" /> Properties</Link>
      <PageHead title={p.name} subtitle={"📍 " + p.location + (p.description ? " · " + p.description : "")}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter units" style={{ width: "auto" }}>
          <option value="all">All units</option><option value="available">Available</option><option value="booked">Booked</option><option value="blocked">Blocked</option>
        </select>
        {admin && (
          <>
            <Button onClick={() => setModal({ building: true })}><Icon name="plus" /> Building</Button>
            <Button variant="danger" onClick={remove}>Delete</Button>
          </>
        )}
      </PageHead>

      {p.buildings.length === 0 ? (
        <div className="card"><Empty icon="🏢" title="No buildings yet" text={admin ? "Add a building, then add units to it." : "Units will appear once an admin adds them."} /></div>
      ) : p.buildings.map((b) => {
        const units = b.units.filter((u) => filter === "all" || u.status === filter);
        return (
          <section className="card" style={{ marginBottom: 16 }} key={b.id}>
            <div className="card-head">
              <div>
                <h2>{b.name}</h2>
                <span className="muted small">{b.floors} floors · {b.units.length} units · {b.units.filter((u) => u.status === "available").length} available</span>
              </div>
              {admin && <Button size="sm" onClick={() => setModal({ unit: b })}><Icon name="plus" /> Unit</Button>}
            </div>
            {units.length === 0
              ? <Empty icon="🏷️" title={b.units.length ? "No units match this filter" : "No units yet"} text={b.units.length ? "Try another filter." : admin ? "Add the first unit to this building." : ""} />
              : (
                <div className="unit-grid">
                  {units.map((u) => (
                    <button key={u.id} className={"unit " + u.status} onClick={() => admin && setModal({ edit: u })}
                      style={admin ? undefined : { cursor: "default" }} aria-label={`Unit ${u.unit_number}, ${u.status}`}>
                      <span className="no">{u.unit_number}</span>
                      <span className="small muted">{u.type} · {u.area_sqft} sqft · Fl {u.floor}</span>
                      <span className="price">{money(u.price)}</span>
                      <Badge value={u.status} />
                    </button>
                  ))}
                </div>
              )}
          </section>
        );
      })}

      {modal?.building && <BuildingForm projectId={p.id} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.unit && <UnitForm building={modal.unit} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.edit && <UnitEdit unit={modal.edit} onClose={() => setModal(null)} onSaved={done} />}
    </>
  );
}

function BuildingForm({ projectId, onClose, onSaved }) {
  const { toast } = useApp();
  const f = useForm({ name: "", floors: 5 });
  const save = f.submit(async (v) => { await api.createBuilding(projectId, { name: v.name, floors: Number(v.floors) }); toast("Building added"); onSaved(); });
  return (
    <Modal title="Add building" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={f.saving} onClick={save}>Add building</Button></>}>
      <form className="form-grid" onSubmit={save}>
        {f.formError && !Object.keys(f.errors).length && <div className="alert error full">{f.formError}</div>}
        <Field label="Name" required error={f.errors.name}><input value={f.values.name} onChange={f.set("name")} placeholder="Tower C" autoFocus /></Field>
        <Field label="Floors" required error={f.errors.floors}><input type="number" min="1" value={f.values.floors} onChange={f.set("floors")} /></Field>
      </form>
    </Modal>
  );
}

function UnitForm({ building, onClose, onSaved }) {
  const { toast } = useApp();
  const f = useForm({ unit_number: "", floor: 1, type: "2 BHK", area_sqft: "", price: "" });
  const save = f.submit(async (v) => {
    await api.createUnit(building.id, { unit_number: v.unit_number.trim(), floor: Number(v.floor), type: v.type, area_sqft: Number(v.area_sqft), price: Number(v.price) });
    toast("Unit added");
    onSaved();
  });
  return (
    <Modal title={"Add unit to " + building.name} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={f.saving} onClick={save}>Add unit</Button></>}>
      <form className="form-grid" onSubmit={save}>
        {f.formError && !Object.keys(f.errors).length && <div className="alert error full">{f.formError}</div>}
        <Field label="Unit number" required error={f.errors.unit_number}><input value={f.values.unit_number} onChange={f.set("unit_number")} placeholder="101" autoFocus /></Field>
        <Field label="Floor" required error={f.errors.floor}><input type="number" min="0" max={building.floors} value={f.values.floor} onChange={f.set("floor")} /></Field>
        <Field label="Type" required><select value={f.values.type} onChange={f.set("type")}>{UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Area (sqft)" required error={f.errors.area_sqft}><input type="number" min="1" value={f.values.area_sqft} onChange={f.set("area_sqft")} /></Field>
        <Field label="Price (₹)" required error={f.errors.price} full><input type="number" min="1" value={f.values.price} onChange={f.set("price")} /></Field>
      </form>
    </Modal>
  );
}

function UnitEdit({ unit, onClose, onSaved }) {
  const { toast } = useApp();
  const f = useForm({ price: unit.price, status: unit.status });
  const locked = unit.status === "booked";
  const save = f.submit(async (v) => {
    const body = { price: Number(v.price) };
    if (!locked) body.status = v.status;
    await api.updateUnit(unit.id, body);
    toast("Unit updated");
    onSaved();
  });
  const del = async () => {
    try { await api.deleteUnit(unit.id); toast("Unit deleted"); onSaved(); } catch (e) { toast(e.message, "error"); }
  };
  return (
    <Modal title={`Unit ${unit.unit_number} · ${unit.type}`} onClose={onClose}
      footer={<>
        <Button variant="danger" onClick={del} disabled={locked}>Delete</Button>
        <div className="grow" />
        <Button onClick={onClose}>Close</Button>
        <Button variant="primary" loading={f.saving} onClick={save}>Save</Button>
      </>}>
      <form className="stack" onSubmit={save}>
        {f.formError && <div className="alert error">{f.formError}</div>}
        {locked && <div className="alert info">This unit is booked. Its status is locked until the booking is cancelled.</div>}
        <Field label="Price (₹)" error={f.errors.price} hint={`${moneyFull(Number(f.values.price))} · price changes don't affect existing bookings`}>
          <input type="number" min="1" value={f.values.price} onChange={f.set("price")} />
        </Field>
        <Field label="Availability">
          <select value={f.values.status} onChange={f.set("status")} disabled={locked}>
            {locked ? <option value="booked">Booked</option> : <><option value="available">Available</option><option value="blocked">Blocked (off sale)</option></>}
          </select>
        </Field>
      </form>
    </Modal>
  );
}
