import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Icon } from "./ui.jsx";
import { useApp } from "../context.jsx";
import { initials } from "../utils.js";

const links = [
  ["/", "Dashboard", "dashboard"],
  ["/leads", "Leads", "leads"],
  ["/properties", "Properties", "building"],
  ["/bookings", "Bookings", "booking"],
  ["/team", "Team", "team", "admin"],
];

export default function Layout() {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <aside className={"sidebar " + (open ? "open" : "")}>
        <div className="brand"><span className="logo"><Icon name="building" /></span> EstateFlow</div>
        <div className="org-pill" title={user.org_name}><small>Workspace</small>{user.org_name}</div>
        <nav className="nav" aria-label="Main">
          {links.filter((l) => !l[3] || l[3] === user.role).map(([path, label, icon]) => (
            <NavLink key={path} to={path} end={path === "/"} onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon name={icon} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <span className="avatar">{initials(user.name)}</span>
          <div className="who"><b>{user.name}</b><span className="small">{user.role === "admin" ? "Administrator" : "Sales employee"}</span></div>
          <button className="btn ghost sm" style={{ color: "#d1d5db" }} onClick={logout} title="Sign out" aria-label="Sign out"><Icon name="logout" /></button>
        </div>
      </aside>
      <div className={"scrim " + (open ? "show" : "")} onClick={() => setOpen(false)} />
      <div className="main">
        <div className="topbar">
          <button className="btn ghost sm" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button> EstateFlow
        </div>
        <main className="page"><Outlet /></main>
      </div>
    </div>
  );
}
