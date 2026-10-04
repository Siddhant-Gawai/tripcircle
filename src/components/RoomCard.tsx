import type { Room } from "../types";
export default function RoomCard({ room: r }: { room: Room }) {
  return (
    <a className="room-card" href={`#room/${r.id}`} key={r.id}>
      <span className="tag">
        {r.organizer ? "Your room" : r.status || "Open to requests"}
      </span>
      <h3>{r.title}</h3>
      <p>
        {r.summary || "A small group, a new plan. Open the trip to learn more."}
      </p>
      <div className="room-meta">
        <span>From {r.origin}</span>
        <span>{r.dates || "Dates to decide"}</span>
        <span>
          {r.members !== undefined
            ? `${r.members}/${r.capacity} people`
            : `Up to ${r.capacity} people`}
        </span>
      </div>
      <strong>View trip →</strong>
    </a>
  );
}
