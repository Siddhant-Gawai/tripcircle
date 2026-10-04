import { useState, useCallback } from "react";
import ConfirmSheet from "./components/ConfirmSheet";
import type React from "react";
import RoomDecisions from "./RoomDecisions";
import type { RoomDetail, Place, Day } from "./types";
import { photo, photoSet, fields } from "./place-utils";
type Props = {
  room: RoomDetail & { plan: NonNullable<RoomDetail["plan"]> };
  places: Place[];
  busy: boolean;
  editing: boolean;
  days: Day[];
  notes: string;
  dates: string;
  editPlan: () => void;
  savePlan: (e: React.FormEvent) => Promise<void>;
  setDays: React.Dispatch<React.SetStateAction<Day[]>>;
  setNotes: (value: string) => void;
  setDates: (value: string) => void;
  setEditing: (value: boolean) => void;
  act: (
    action: string,
    data?: Record<string, unknown>,
  ) => Promise<boolean | undefined>;
  copy: (text: string) => void;
  setPlaceRoom: (id: string) => void;
  request: (action: string, data?: Record<string, unknown>) => Promise<any>;
  onChanged: () => Promise<void>;
};
export default function RoomPlanner({
  room,
  places,
  busy,
  editing,
  days,
  notes,
  dates,
  editPlan,
  savePlan,
  setDays,
  setNotes,
  setDates,
  setEditing,
  act,
  copy,
  setPlaceRoom,
  request,
  onChanged,
}: Props) {
  const [removeMember, setRemoveMember] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const cancelRemoval = useCallback(() => setRemoveMember(null), []);
  return (
    <div className="room-workspace">
      {removeMember && (
        <ConfirmSheet
          name={removeMember.name}
          cancel={cancelRemoval}
          confirm={() => {
            void act("remove_member", { user_id: removeMember.id });
            setRemoveMember(null);
          }}
        />
      )}
      <nav className="filters room-tabs" aria-label="Room sections">
        {["Plan", "Places", "Decisions", "Packing", "Discussion"].map(
          (label) => (
            <a
              href={`#room/${room.id}`}
              key={label}
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById(`room-${label.toLowerCase()}`)
                  ?.scrollIntoView({ block: "start" });
              }}
            >
              {label}
            </a>
          ),
        )}
      </nav>
      <div className="planner-grid">
        <div className="planner-main">
          <div id="room-decisions">
            <RoomDecisions
              room={room}
              places={places}
              busy={busy}
              request={request}
              onChanged={onChanged}
            />
          </div>
          <section className="panel" id="room-plan">
            <div className="section-top">
              <div>
                <p className="eyebrow">THE ROUTE, AT OUR PACE</p>
                <h2>Day-by-day plan</h2>
              </div>
              {room.organizer && !editing && (
                <button onClick={editPlan}>Edit plan</button>
              )}
            </div>
            {editing ? (
              <form onSubmit={savePlan}>
                <label>
                  Dates
                  <input
                    maxLength={100}
                    value={dates}
                    onChange={(e) => setDates(e.target.value)}
                    placeholder="e.g. 30 Oct – 1 Nov"
                  />
                </label>
                {days.map((d, i) => (
                  <div className="day-edit" key={i}>
                    <label>
                      Day {i + 1} heading
                      <input
                        required
                        maxLength={150}
                        value={d.title}
                        onChange={(e) =>
                          setDays(
                            days.map((x, j) =>
                              j === i ? { ...x, title: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Timings, travel & stops
                      <textarea
                        maxLength={3000}
                        value={d.body}
                        onChange={(e) =>
                          setDays(
                            days.map((x, j) =>
                              j === i ? { ...x, body: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="07:00 leave · 12:00 lunch · 17:00 sunset viewpoint"
                      />
                    </label>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setDays(days.filter((_, j) => j !== i))}
                    >
                      Remove day
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={days.length >= 21}
                  onClick={() =>
                    setDays([
                      ...days,
                      { title: `Day ${days.length + 1}`, body: "" },
                    ])
                  }
                >
                  + Add day
                </button>
                <label>
                  Transport, stays & other notes
                  <textarea
                    maxLength={4000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <div className="inline-actions">
                  <button className="primary" disabled={busy}>
                    Save itinerary
                  </button>
                  <button type="button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {room.plan.days.length ? (
                  room.plan.days.map((d, i) => (
                    <article className="day" key={i}>
                      <span>DAY {i + 1}</span>
                      <h3>{d.title}</h3>
                      <p className="preserve">{d.body}</p>
                    </article>
                  ))
                ) : (
                  <p className="muted">
                    Start with travel, a quiet base and one or two stops. The
                    organizer can add days and timings.
                  </p>
                )}
                {room.plan.notes && (
                  <div className="plan-notes">
                    <h3>Transport & stay notes</h3>
                    <p className="preserve">{room.plan.notes}</p>
                  </div>
                )}
                <p className="small muted">
                  Everyone can suggest changes below. The organizer saves the
                  final itinerary.
                </p>
              </>
            )}
          </section>
          <section className="panel" id="room-places">
            <p className="eyebrow">CHOOSE TOGETHER</p>
            <h2>Place shortlist</h2>
            <p className="muted">One changeable pick per person.</p>
            {places
              .filter((p) => room.plan?.destinations.includes(p.id))
              .map((p) => (
                <div className="shortlist-row" key={p.id}>
                  <a
                    href={`#place/${p.id}`}
                    onClick={() => setPlaceRoom(room.id)}
                    aria-label={`View ${p.name}: photos, viewpoints and stays`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flex: 1,
                      minWidth: 0,
                      padding: "6px 0",
                    }}
                  >
                    {p.details?.photos?.[0] && (
                      <img
                        src={photo(p.details.photos[0])}
                        srcSet={photoSet(p.details.photos[0])}
                        sizes="75px"
                        decoding="async"
                        alt=""
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <h3>{p.name}</h3>
                      <span>{p.journey}</span>
                      <span
                        style={{
                          display: "block",
                          color: "#426448",
                          marginTop: 6,
                          fontWeight: 600,
                        }}
                      >
                        View place →
                      </span>
                    </div>
                  </a>
                  <button
                    disabled={busy}
                    aria-pressed={room.my_vote === p.id}
                    className={room.my_vote === p.id ? "picked" : ""}
                    onClick={() =>
                      act("vote", {
                        destination: room.my_vote === p.id ? null : p.id,
                      })
                    }
                  >
                    {room.my_vote === p.id ? "✓ Picked" : "Pick"} ·{" "}
                    {room.votes?.[p.id] || 0}
                  </button>
                </div>
              ))}
            {!room.plan.destinations.length && (
              <p className="muted">No places shortlisted yet.</p>
            )}
            {room.organizer && (
              <details>
                <summary>Choose from the onboarded places</summary>
                <div className="shortlist-choices">
                  {places.map((p) => (
                    <button
                      key={p.id}
                      disabled={busy}
                      aria-pressed={room.plan?.destinations.includes(p.id)}
                      onClick={() => act("shortlist", { destination: p.id })}
                    >
                      {room.plan?.destinations.includes(p.id) ? "✓ " : "+ "}
                      {p.name}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </section>
          <section className="panel" id="room-discussion">
            <p className="eyebrow">LESS BACK-AND-FORTH</p>
            <h2>Comments & suggestions</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = fields(form);
                if (await act("post", data))
                  (
                    form.elements.namedItem("body") as HTMLTextAreaElement
                  ).value = "";
              }}
            >
              <label>
                Share a
                <select name="kind">
                  <option value="comment">Comment</option>
                  <option value="suggestion">Suggestion</option>
                </select>
              </label>
              <label>
                Your message
                <textarea
                  name="body"
                  required
                  maxLength={1500}
                  placeholder="Suggest a stop, a better time, a stay or transport option…"
                />
              </label>
              <button className="primary" disabled={busy}>
                Share with the room
              </button>
            </form>
            <div className="post-list">
              {room.posts?.map((p) => (
                <article className="post" key={p.id}>
                  <div className="post-heading">
                    <strong>{p.name}</strong>
                    <span className="tag">{p.kind}</span>
                    <time dateTime={p.created_at}>
                      {new Date(p.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p className="preserve">{p.body}</p>
                  {p.mine && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => act("remove_post", { post_id: p.id })}
                    >
                      Remove my message
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
        <aside className="planner-side">
          {room.organizer && (
            <section className="panel invite-panel">
              <p className="eyebrow">INVITE YOUR PEOPLE</p>
              <h2>Room code</h2>
              <strong className="room-code">{room.code}</strong>
              <button
                onClick={() =>
                  copy(
                    `${location.origin}${import.meta.env.BASE_URL}#join/${room.code}`,
                  )
                }
              >
                Copy invite link
              </button>
              <a
                className="primary whatsapp-invite"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`Join our trip: ${room.title}\nRoom code: ${room.code}\n${location.origin}${import.meta.env.BASE_URL}#join/${room.code}`)}`}
              >
                Share to WhatsApp
              </a>
              <label>
                Who can find this trip?
                <select
                  value={room.visibility}
                  disabled={busy}
                  onChange={(e) =>
                    act("visibility", {
                      visibility: e.target.value,
                    })
                  }
                >
                  <option value="private">Private · code only</option>
                  <option value="public">Public · discoverable</option>
                </select>
              </label>
              <p className="small">
                Public shares only the trip preview. Plans and discussion remain
                for approved members.
              </p>
            </section>
          )}
          <section className="panel">
            <h2>Your people</h2>
            <div className="member-list">
              {room.members?.map((m, i) => (
                <div key={m.id || i}>
                  <span className="avatar">
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{m.name}</strong>
                    <small>{m.organizer ? "Organizer" : m.status}</small>
                  </div>
                  {room.organizer && m.status === "pending" && (
                    <div className="member-actions">
                      <button
                        disabled={busy}
                        onClick={() => act("approve", { user_id: m.id })}
                      >
                        Accept
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => act("reject", { user_id: m.id })}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {room.organizer &&
                    m.status === "approved" &&
                    !m.organizer && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          setRemoveMember({ id: m.id, name: m.name });
                        }}
                      >
                        Remove
                      </button>
                    )}
                </div>
              ))}
            </div>
          </section>
          <section className="panel" id="room-packing">
            <p className="eyebrow">PACK LIGHT, PLAN WELL</p>
            <h2>Backpacks & checklist</h2>
            <div className="checklist">
              {room.plan.checklist.map((t) => (
                <label key={t.id} className={t.done ? "done" : ""}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={busy}
                    onChange={() => act("toggle_task", { task_id: t.id })}
                  />
                  <span>
                    {t.title}
                    <small>{t.owner || "Unassigned"}</small>
                  </span>
                </label>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                if (await act("add_task", fields(form))) form.reset();
              }}
            >
              <label>
                Add an item
                <input
                  name="title"
                  required
                  maxLength={150}
                  placeholder="e.g. Book the train"
                />
              </label>
              <label>
                Who is handling it?
                <input
                  name="owner"
                  maxLength={60}
                  placeholder="Name or Everyone"
                />
              </label>
              <button disabled={busy} className="primary">
                Add to checklist
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
