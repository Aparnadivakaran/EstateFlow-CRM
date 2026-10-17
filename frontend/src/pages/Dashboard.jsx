import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { Badge, Empty, ErrorState, PageHead } from "../components/ui.jsx";
import { fmtDate, followState, money, slug } from "../utils.js";

function Stat({ label, value, sub, tone = "", to }) {
  const inner = (
    <>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub || " "}</div>
    </>
  );
  return to
    ? <Link className={"card stat " + tone} to={to} style={{ color: "inherit", textDecoration: "none" }}>{inner}</Link>
    : <div className={"card stat " + tone}>{inner}</div>;
}

export default function Dashboard() {
  const { user } = useApp();
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const team = user.role === "admin";

  if (error) return <div className="card"><ErrorState error={error} onRetry={refetch} /></div>;
  if (isLoading) {
    return (
      <>
        <PageHead title="Dashboard" />
        <div className="stats">
          {[1, 2, 3, 4].map((i) => (
            <div className="card stat" key={i}>
              <div className="skel" style={{ width: "60%" }} />
              <div className="skel" style={{ height: 28, marginTop: 10, width: "40%" }} />
            </div>
          ))}
        </div>
      </>
    );
  }

  const t = d.totals;
  const max = Math.max(1, ...d.by_stage.map((s) => s.count));
  const inv = d.inventory;
  const invTotal = Math.max(1, inv.available + inv.booked + inv.blocked);

  return (
    <>
      <PageHead title={`Hello, ${user.name.split(" ")[0]} 👋`} subtitle={team ? "Here's how the whole team is doing." : "Here's what needs your attention."} />
      <div className="stats">
        <Stat label={team ? "Total leads" : "My leads"} value={t.leads} sub={`${t.open_leads} still open`} to="/leads" />
        <Stat label="Follow-ups overdue" value={t.overdue_followups} tone={t.overdue_followups ? "warn" : ""} sub="Needs action now" to="/leads" />
        <Stat label="Follow-ups today" value={t.followups_today} sub="Scheduled for today" to="/leads" />
        <Stat label="Bookings this month" value={t.bookings_this_month} tone="good" sub={money(t.sales_value_this_month)} to="/bookings" />
        <Stat label={team ? "Total booked value" : "My booked value"} value={money(t.sales_value)} sub={`${t.active_bookings} active bookings`} />
        <Stat label="Conversion" value={t.conversion_rate + "%"} sub="Leads → Booked" />
        {team && <Stat label="Unassigned open leads" value={t.unassigned} tone={t.unassigned ? "warn" : ""} sub="Assign them to someone" />}
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
                      <div>
                        <div className="cell-main">{l.name}</div>
                        <div className="cell-sub">{l.phone}{team && l.assigned_to ? " · " + l.assigned_to : ""}</div>
                      </div>
                      <div className="right">
                        <Badge value={l.stage} />
                        <div className={"small " + (st === "overdue" ? "late" : st === "today" ? "today" : "muted")}>
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
                    <div>
                      <div className="cell-main">{b.lead.name}</div>
                      <div className="cell-sub">{b.project_name} · {b.building_name} · Unit {b.unit.unit_number}</div>
                    </div>
                    <div className="right cell-main">{money(b.agreed_price)}<div className="cell-sub">{fmtDate(b.created_at)}</div></div>
                  </Link>
                ))}
          </section>
        </div>

        <div className="stack">
          <section className="card card-pad">
            <h2 style={{ marginBottom: 6 }}>Leads by stage</h2>
            {d.by_stage.map((s) => (
              <div className="bar-row" key={s.stage}>
                <span>{s.stage}</span>
                <div className="bar-track"><div className={"bar-fill " + slug(s.stage)} style={{ width: `${(s.count / max) * 100}%` }} /></div>
                <b className="right">{s.count}</b>
              </div>
            ))}
          </section>

          <section className="card card-pad">
            <h2 style={{ marginBottom: 10 }}>Inventory</h2>
            <div className="meter">
              <i className="a" style={{ width: `${(inv.available / invTotal) * 100}%` }} />
              <i className="b" style={{ width: `${(inv.booked / invTotal) * 100}%` }} />
            </div>
            <div className="row wrap small" style={{ marginTop: 10 }}>
              <Badge value="available" label={inv.available + " available"} />
              <Badge value="booked" label={inv.booked + " booked"} />
              {inv.blocked > 0 && <Badge value="blocked" label={inv.blocked + " blocked"} />}
            </div>
          </section>

          {team && (
            <section className="card">
              <div className="card-head"><h2>Team performance</h2></div>
              {d.leaderboard.length === 0
                ? <Empty title="No sales staff yet" text="Add employees on the Team page." />
                : d.leaderboard.map((r, i) => (
                    <div className="list-item" key={r.id}>
                      <div className="row"><span className="avatar" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>{i + 1}</span><b>{r.name}</b></div>
                      <div className="right"><b>{r.bookings}</b> <span className="muted small">bookings</span><div className="cell-sub">{money(r.value)}</div></div>
                    </div>
                  ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
