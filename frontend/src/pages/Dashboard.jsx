import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { Avatar, Badge, Empty, ErrorState, Icon, PageHead, Progress } from "../components/ui.jsx";
import { BarChart, Gauge } from "../components/charts.jsx";
import { fmtDate, followState, money } from "../utils.js";

/** Month-over-month change chip: ↑ 12% / ↓ 5% / flat */
function Trend({ cur, prev }) {
  if (!prev && !cur) return <span className="trend flat">0%</span>;
  if (!prev) return <span className="trend"><Icon name="arrowUp" />New</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span className="trend flat">0%</span>;
  return <span className={"trend " + (pct < 0 ? "down" : "")}><Icon name={pct < 0 ? "arrowDown" : "arrowUp"} />{Math.abs(pct)}%</span>;
}

function Kpi({ label, value, trend, foot, icon, tone = "", hero, to }) {
  const body = (
    <>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className={"kpi-icon " + tone}><Icon name={icon} /></span>
      </div>
      <div className="kpi-value"><b>{value}</b>{trend}</div>
      <div className="kpi-foot">{foot}</div>
    </>
  );
  const cls = "card kpi " + (hero ? "hero" : "");
  return to ? <Link className={cls} to={to}>{body}</Link> : <div className={cls}>{body}</div>;
}

const METRICS = {
  value: { label: "Booked value", get: (d) => d.value, axis: (v) => money(v).replace(".00", ""), title: "Booked value per month" },
  bookings: { label: "Bookings", get: (d) => d.bookings, axis: (v) => Math.round(v), title: "Bookings per month" },
  leads: { label: "New leads", get: (d) => d.leads, axis: (v) => Math.round(v), title: "New leads per month" },
};

export default function Dashboard() {
  const { user } = useApp();
  const [metric, setMetric] = useState("value");
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const team = user.role === "admin";

  if (error) return <div className="card"><ErrorState error={error} onRetry={refetch} /></div>;
  if (isLoading) {
    return (
      <>
        <PageHead title="Dashboard" />
        <div className="kpis">
          {[1, 2, 3, 4].map((i) => (
            <div className="card kpi" key={i}><div className="skel" style={{ width: "50%" }} /><div className="skel" style={{ height: 32, width: "40%", marginTop: 12 }} /><div className="skel" style={{ width: "35%", marginTop: 10 }} /></div>
          ))}
        </div>
        <div className="card" style={{ height: 340 }} />
      </>
    );
  }

  const t = d.totals, inv = d.inventory;
  const cur = d.monthly[d.monthly.length - 1], prev = d.monthly[d.monthly.length - 2];
  const m = METRICS[metric];
  const unitsTotal = inv.available + inv.booked + inv.blocked;
  const maxStage = Math.max(1, ...d.by_stage.map((s) => s.count));
  const month = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <>
      <PageHead title={`Welcome back, ${user.name.split(" ")[0]}`} subtitle={`${team ? "Team" : "Your"} sales overview · ${month}`} />

      <div className="kpis">
        <Kpi hero to="/bookings" label="Booked value" icon="rupee" value={money(cur.value)}
          trend={<Trend cur={cur.value} prev={prev.value} />} foot={`Last month: ${money(prev.value)}`} />
        <Kpi label="New leads" icon="leads" value={cur.leads} trend={<Trend cur={cur.leads} prev={prev.leads} />}
          foot={`Last month: ${prev.leads}`} to="/leads" />
        <Kpi label="Bookings" icon="cube" tone="blue" value={cur.bookings} trend={<Trend cur={cur.bookings} prev={prev.bookings} />}
          foot={`Last month: ${prev.bookings} · ${t.active_bookings} active in total`} to="/bookings" />
        <Kpi label="Follow-ups overdue" icon="calendar" tone={t.overdue_followups ? "red" : "green"} value={t.overdue_followups}
          trend={t.overdue_followups ? <span className="trend down">Action needed</span> : <span className="trend"><Icon name="check" />All clear</span>}
          foot={`${t.followups_today} due today${team ? ` · ${t.unassigned} unassigned` : ""}`} to="/leads" />
      </div>

      <div className="dash-row">
        <section className="card card-pad">
          <div className="card-title">
            <h2>Performance overview</h2>
            <div className="seg" role="group" aria-label="Chart metric">
              {Object.entries(METRICS).map(([k, v]) => <button key={k} className={metric === k ? "on" : ""} onClick={() => setMetric(k)}>{v.label}</button>)}
            </div>
          </div>
          <BarChart data={d.monthly} valueOf={m.get} axis={m.axis} title={m.title}
            tip={(x) => [["Booked value", money(x.value)], ["Bookings", x.bookings], ["New leads", x.leads]]} />
        </section>

        <section className="card card-pad">
          <div className="card-title"><h2>Lead conversion</h2></div>
          <Gauge pct={t.conversion_rate} label="Leads → Booked" />
          <div className="mini-tiles">
            <div className="mini"><span>Units sold</span><b>{inv.booked}<small className="muted" style={{ fontWeight: 500 }}> / {unitsTotal}</small></b></div>
            <div className="mini"><span>Open leads</span><b>{t.open_leads}</b></div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="row spread small muted" style={{ marginBottom: 6 }}><span>Inventory sold</span><span>{unitsTotal ? Math.round((inv.booked / unitsTotal) * 100) : 0}%</span></div>
            <Progress value={unitsTotal ? (inv.booked / unitsTotal) * 100 : 0} tone="grad" />
            <div className="row wrap small" style={{ marginTop: 10, gap: 6 }}>
              <Badge value="available" label={inv.available + " available"} />
              {inv.blocked > 0 && <Badge value="blocked" label={inv.blocked + " blocked"} />}
            </div>
          </div>
        </section>
      </div>

      <div className="cols">
        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Upcoming follow-ups</h2><Link to="/leads" className="small">All leads →</Link></div>
            {d.follow_ups.length === 0
              ? <Empty icon="🎉" title="You're all caught up" text="No follow-ups due in the next 7 days." />
              : d.follow_ups.map((l) => {
                  const st = followState(l.next_follow_up, l.stage);
                  return (
                    <Link className="list-item" to={"/leads/" + l.id} key={l.id}>
                      <div className="who-cell">
                        <Avatar name={l.name} />
                        <div><div className="cell-main">{l.name}</div><div className="cell-sub">{l.phone}{team && l.assigned_to ? " · " + l.assigned_to : ""}</div></div>
                      </div>
                      <div className="right">
                        <Badge value={l.stage} />
                        <div className={"small " + (st === "overdue" ? "late" : st === "today" ? "today" : "muted")} style={{ marginTop: 4 }}>
                          {st === "overdue" ? "Overdue · " : st === "today" ? "Today · " : ""}{fmtDate(l.next_follow_up)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
          </section>

          <section className="card">
            <div className="card-head"><h2>Recent bookings</h2><Link to="/bookings" className="small">View all →</Link></div>
            {d.recent_bookings.length === 0
              ? <Empty icon="🏠" title="No bookings yet" text="Bookings you make will show up here." />
              : d.recent_bookings.map((b) => (
                  <Link className="list-item" to={"/leads/" + b.lead.id} key={b.id}>
                    <div className="who-cell">
                      <Avatar name={b.lead.name} />
                      <div><div className="cell-main">{b.lead.name}</div><div className="cell-sub">{b.project_name} · {b.building_name} · Unit {b.unit.unit_number}</div></div>
                    </div>
                    <div className="right"><div className="cell-main num">{money(b.agreed_price)}</div><div className="cell-sub">{fmtDate(b.created_at)}</div></div>
                  </Link>
                ))}
          </section>
        </div>

        <div className="stack">
          <section className="card card-pad">
            <div className="card-title"><h2>Leads by stage</h2><span className="small muted">{t.leads} total</span></div>
            {d.by_stage.map((s) => (
              <div className="bar-row" key={s.stage}>
                <span>{s.stage}</span>
                <Progress value={(s.count / maxStage) * 100} tone={s.stage === "Booked" ? "green" : s.stage === "Lost" ? "red" : ""} />
                <b className="right num">{s.count}</b>
              </div>
            ))}
          </section>

          {team && (
            <section className="card">
              <div className="card-head"><h2>Team performance</h2></div>
              {d.leaderboard.length === 0
                ? <Empty title="No sales staff yet" text="Add employees on the Team page." />
                : d.leaderboard.map((r, i) => (
                    <div className="list-item" key={r.id}>
                      <div className="who-cell"><Avatar name={r.name} /><div><div className="cell-main">{r.name}</div><div className="cell-sub">#{i + 1} · {r.bookings} bookings</div></div></div>
                      <div className="cell-main num">{money(r.value)}</div>
                    </div>
                  ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
