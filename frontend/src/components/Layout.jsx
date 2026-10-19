import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import { Avatar, Icon } from "./ui.jsx";
import { useApp } from "../context.jsx";

const groups = [
  ["Overview", [["/", "Dashboard", "dashboard"], ["/leads", "Leads", "leads"], ["/bookings", "Bookings", "booking"]]],
  ["Inventory", [["/properties", "Properties", "building"]]],
  ["Admin", [["/team", "Team", "team", "admin"]]],
];

export default function Layout() {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false);
  // shares the dashboard cache, so the "overdue" badge costs no extra request
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const overdue = dash?.totals.overdue_followups || 0;

  return (
    <div className="shell">
      <aside className={"sidebar " + (open ? "open" : "")}>
        <div className="brand"><span className="logo"><Icon name="building" /></span> EstateFlow</div>
        <div className="ws" title={user.org_name}>
          <span className="ws-ico"><Icon name="building" /></span>
          <div className="ws-name"><b>{user.org_name}</b><small>Workspace</small></div>
        </div>
        <nav className="nav" aria-label="Main">
          {groups.map(([label, links]) => {
            const visible = links.filter((l) => !l[3] || l[3] === user.role);
            return visible.length > 0 && (
              <div key={label}>
                <div className="nav-label">{label}</div>
                {visible.map(([path, text, icon]) => (
                  <NavLink key={path} to={path} end={path === "/"} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? "active" : "")}>
                    <Icon name={icon} /> {text}
                    {path === "/leads" && overdue > 0 && <span className="count" title={`${overdue} overdue follow-ups`}>{overdue}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="me">
          <Avatar name={user.name} />
          <div className="who"><b>{user.name}</b><span>{user.role === "admin" ? "Administrator" : "Sales employee"}</span></div>
          <button className="btn ghost sm icon-only" onClick={logout} title="Sign out" aria-label="Sign out"><Icon name="logout" /></button>
        </div>
      </aside>
      <div className={"scrim " + (open ? "show" : "")} onClick={() => setOpen(false)} />
      <div className="main">
        <div className="topbar">
          <button className="btn ghost sm icon-only" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button> EstateFlow
        </div>
        <main className="page"><Outlet /></main>
      </div>
    </div>
  );
}
