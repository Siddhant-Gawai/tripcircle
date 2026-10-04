import { useState } from "react";
import type { Place } from "../types";
import DestinationCard from "./DestinationCard";
export default function DemoRoom({ places }: { places: Place[] }) {
  const [tab, setTab] = useState("Plan");
  return (
    <section className="public-section demo-room">
      <a className="back" href={import.meta.env.BASE_URL}>
        ← Back to TripCircle
      </a>
      <p className="eyebrow">SAMPLE ROOM · READ ONLY</p>
      <h1>A quiet weekend in the hills</h1>
      <p className="subtitle">
        See how your group can plan together. These are sample people and
        decisions.
      </p>
      <dl className="overview-facts demo-overview" aria-label="Trip overview">
        {[
          ["Dates", "3 days · To decide"],
          ["Members", "6 sample friends"],
          ["Budget / person", "₹6,000 · Sample"],
          ["Stay / transport", "Homestay · Shared car"],
          ["Packing", "0% ready"],
          ["Meeting point", "Ahmedabad · To decide"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="filters room-tabs" aria-label="Demo room sections">
        {["Plan", "Places", "Decisions", "Packing", "Discussion"].map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Plan" && (
        <div className="room-preview">
          {[
            [
              "Day 1 · Travel & settle in",
              "07:00 Depart Ahmedabad · 17:00 Check in · Sunset walk if there is time",
            ],
            [
              "Day 2 · A slow day outside",
              "09:00 Breakfast · 10:30 Hanuman Point · 13:00 Local lunch · Afternoon free",
            ],
            [
              "Day 3 · Breakfast & home",
              "08:00 Breakfast · 09:00 Pack up · 10:00 Return journey",
            ],
          ].map(([title, body]) => (
            <div key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          ))}
          <p className="muted">
            Illustrative timings. Confirm road conditions and stay availability.
          </p>
        </div>
      )}
      {tab === "Places" && (
        <>
          <p>
            Sample shortlist: each person gets one changeable destination pick.
          </p>
          <div className="cards">
            {places
              .filter((p) => ["jawhar", "bordi"].includes(p.id))
              .map((p) => (
                <div key={p.id}>
                  <DestinationCard place={p} />
                  <p>{p.id === "jawhar" ? "4" : "2"} sample picks</p>
                </div>
              ))}
          </div>
        </>
      )}
      {tab === "Decisions" && (
        <div className="room-preview">
          <h2>Choose together</h2>
          <div>
            <strong>Stay · Small homestay</strong>
            <span>4 sample votes · Organizer to confirm</span>
          </div>
          <div>
            <strong>Travel · Shared car</strong>
            <span>3 sample votes · Check availability</span>
          </div>
          <div>
            <strong>Budget · ₹6,000 per person</strong>
            <span>Illustrative budget; bookings not confirmed</span>
          </div>
        </div>
      )}
      {tab === "Packing" && (
        <div className="room-preview">
          <h2>Who is bringing what?</h2>
          {[
            ["Water bottles", "Everyone"],
            ["First-aid kit", "Asha"],
            ["Snacks", "Rohan"],
            ["Chargers and power bank", "Everyone"],
          ].map(([item, person]) => (
            <div key={item}>
              <strong>{item}</strong>
              <span>{person} · To pack</span>
            </div>
          ))}
        </div>
      )}
      {tab === "Discussion" && (
        <div className="room-preview">
          <h2>Comments & suggestions</h2>
          <div>
            <strong>Asha · Suggestion</strong>
            <p>
              Can we keep Saturday afternoon free instead of adding another
              stop?
            </p>
          </div>
          <div>
            <strong>Rohan · Transport</strong>
            <p>Let’s compare a shared car with the train before we confirm.</p>
          </div>
          <p className="muted">
            Sample discussion. Posting and voting are available in your own
            room.
          </p>
        </div>
      )}
      <a className="primary" href="#create">
        Create your own trip room →
      </a>
    </section>
  );
}
