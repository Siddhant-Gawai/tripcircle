import RoomCard from "./RoomCard";
import type { Room } from "../types";
export default function RoomList({ rooms }: { rooms: Room[] }) {
  if (!rooms.length) return null;
  return (
    <section className="public-section" id="trips">
      <div className="section-top">
        <div>
          <p className="eyebrow">GOOD PLANS, NEW PEOPLE</p>
          <h2>Discover public trips</h2>
          <p className="muted">
            Browse a preview. Request to join. The organizer approves every
            member.
          </p>
        </div>
        <a href="#create">Start a trip →</a>
      </div>
      <div className="room-cards">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </section>
  );
}
