import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { Badge, Button, Empty, ErrorState, PageHead, SkeletonRows } from "../components/ui.jsx";
import CancelBookingModal from "../components/CancelBookingModal.jsx";
import { fmtDate, moneyFull } from "../utils.js";

export default function Bookings() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState("active");
  const [cancelling, setCancelling] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["bookings", { status }], queryFn: () => api.bookings({ status }) });

  return (
    <>
      <PageHead title="Bookings" subtitle={user.role === "admin" ? "All bookings across the team." : "Bookings you made or for your leads."} />
      <section className="card">
        <div className="toolbar">
          <div className="chips">
            {[["active", "Active"], ["cancelled", "Cancelled"], ["", "All"]].map(([v, l]) => (
              <button key={l} className={"chip " + (status === v ? "on" : "")} onClick={() => setStatus(v)}>{l}</button>
            ))}
          </div>
        </div>
        {error ? <ErrorState error={error} onRetry={refetch} />
          : isLoading ? <SkeletonRows cols={5} />
          : data.length === 0 ? <Empty icon="📑" title="No bookings here" text={status === "active" ? "Open a lead and choose “Book a unit”." : "Nothing to show for this filter."} />
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Customer</th><th>Unit</th><th className="hide-sm">Price</th><th className="hide-sm">Booked by</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {data.map((b) => (
                    <tr key={b.id} className="click" onClick={() => navigate("/leads/" + b.lead.id)}>
                      <td><div className="cell-main">{b.lead.name}</div><div className="cell-sub">{b.lead.phone}</div></td>
                      <td><div className="cell-main">Unit {b.unit.unit_number} · {b.unit.type}</div><div className="cell-sub">{b.project_name} · {b.building_name}</div></td>
                      <td className="hide-sm"><div className="cell-main">{moneyFull(b.agreed_price)}</div><div className="cell-sub">Token {moneyFull(b.token_amount)}</div></td>
                      <td className="hide-sm">{b.booked_by.name}<div className="cell-sub">{fmtDate(b.created_at)}</div></td>
                      <td><Badge value={b.status} />{b.cancel_reason && <div className="cell-sub">{b.cancel_reason}</div>}</td>
                      <td className="right">
                        {b.status === "active" && (user.role === "admin" || b.booked_by.id === user.id) &&
                          <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); setCancelling(b); }}>Cancel</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
      {cancelling && <CancelBookingModal booking={cancelling} onClose={() => setCancelling(null)} onCancelled={() => setCancelling(null)} />}
    </>
  );
}
