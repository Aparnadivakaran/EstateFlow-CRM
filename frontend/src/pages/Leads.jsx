import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { useDebounced } from "../hooks.js";
import { Badge, Button, Empty, ErrorState, Icon, PageHead, Pagination, SkeletonRows } from "../components/ui.jsx";
import LeadForm from "../components/LeadForm.jsx";
import { fmtDate, followState, money, STAGES } from "../utils.js";

const FOLLOWUPS = [["", "Any follow-up"], ["overdue", "Overdue"], ["today", "Today"], ["upcoming", "Upcoming"], ["none", "Not scheduled"]];
const PAGE_SIZE = 12;

export default function Leads() {
  const { user } = useApp();
  const navigate = useNavigate();
  const isAdmin = user.role === "admin";
  const [filters, setFilters] = useState({ search: "", stage: "", followup: "", assignee: "" });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useDebounced(filters.search, 300);
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: api.users, enabled: isAdmin });

  // Changing any filter goes back to page 1
  const setFilter = (key) => (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); };
  const clear = () => { setFilters({ search: "", stage: "", followup: "", assignee: "" }); setPage(1); };

  const params = { q, stage: filters.stage, followup: filters.followup, assigned_to: filters.assignee, page, page_size: PAGE_SIZE };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["leads", params],
    queryFn: () => api.leads(params),
    placeholderData: keepPreviousData,   // keep showing the old rows (dimmed) while the next page loads
  });

  const filtered = q || filters.stage || filters.followup || filters.assignee;

  return (
    <>
      <PageHead title="Leads" subtitle={isAdmin ? "Every lead across the team." : "Leads assigned to you."}>
        <Button variant="primary" onClick={() => setCreating(true)}><Icon name="plus" /> New lead</Button>
      </PageHead>
      <section className="card">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" />
            <input type="search" placeholder="Search name, phone or email" value={filters.search} onChange={setFilter("search")} aria-label="Search leads" />
          </div>
          <select value={filters.stage} onChange={setFilter("stage")} aria-label="Filter by stage">
            <option value="">All stages</option>{STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={filters.followup} onChange={setFilter("followup")} aria-label="Filter by follow-up">
            {FOLLOWUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {isAdmin && (
            <select value={filters.assignee} onChange={setFilter("assignee")} aria-label="Filter by employee">
              <option value="">All employees</option><option value="0">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          {filtered && <Button variant="ghost" onClick={clear}>Clear</Button>}
        </div>

        {error ? <ErrorState error={error} onRetry={refetch} />
          : isLoading ? <SkeletonRows rows={6} cols={5} />
          : data.items.length === 0 ? (
            filtered
              ? <Empty icon="🔍" title="No leads match" text="Try a different search or clear the filters." action={<Button onClick={clear}>Clear filters</Button>} />
              : <Empty icon="👥" title="No leads yet" text="Add your first lead to get started." action={<Button variant="primary" onClick={() => setCreating(true)}>New lead</Button>} />
          ) : (
            <>
              <div className="table-wrap" style={{ opacity: isFetching ? 0.6 : 1 }}>
                <table>
                  <thead>
                    <tr><th>Lead</th><th>Stage</th><th className="hide-sm">Budget</th>{isAdmin && <th className="hide-sm">Assigned to</th>}<th>Follow-up</th></tr>
                  </thead>
                  <tbody>
                    {data.items.map((l) => {
                      const st = followState(l.next_follow_up, l.stage);
                      return (
                        <tr className="click" key={l.id} tabIndex={0} onClick={() => navigate("/leads/" + l.id)}
                          onKeyDown={(e) => e.key === "Enter" && navigate("/leads/" + l.id)}>
                          <td>
                            <div className="cell-main">{l.name}</div>
                            <div className="cell-sub">{l.phone}{l.interested_project ? " · " + l.interested_project.name : ""}</div>
                          </td>
                          <td><Badge value={l.stage} /></td>
                          <td className="hide-sm">{money(l.budget)}</td>
                          {isAdmin && <td className="hide-sm">{l.assigned_to?.name || <span className="muted">Unassigned</span>}</td>}
                          <td className={"nowrap " + (st === "overdue" ? "late" : st === "today" ? "today" : "")}>
                            {l.next_follow_up ? fmtDate(l.next_follow_up) : <span className="muted">—</span>}
                            {st === "overdue" ? " · overdue" : st === "today" ? " · today" : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={data.page} pageSize={data.page_size} total={data.total} onChange={setPage} />
            </>
          )}
      </section>
      {creating && <LeadForm onClose={() => setCreating(false)} onSaved={(l) => { setCreating(false); navigate("/leads/" + l.id); }} />}
    </>
  );
}
