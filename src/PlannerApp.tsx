import MobileNav from "./components/MobileNav";
import DemoRoom from "./components/DemoRoom";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config";
import type { Place, Room, RoomDetail, Day } from "./types";
import { fields } from "./place-utils";
import PlaceDetail from "./components/PlaceDetail";
import DestinationCard from "./components/DestinationCard";
import RoomCard from "./components/RoomCard";
import { subscribeUpdates } from "./realtime";
import catalogue from "./catalogue.json";
const PlaceSearch = lazy(() => import("./components/PlaceSearch"));
const RoomPlanner = lazy(() => import("./RoomPlanner"));
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { storageKey: "tripcircle-public-auth", flowType: "pkce" },
});
export default function PlannerApp() {
  const [route, setRoute] = useState(location.hash),
    [places, setPlaces] = useState<Place[]>([]),
    [rooms, setRooms] = useState<Room[]>([]),
    [mine, setMine] = useState<Room[]>([]),
    [room, setRoom] = useState<RoomDetail | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(false),
    [google, setGoogle] = useState<boolean | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [filter, setFilter] = useState("All"),
    [modal, setModal] = useState<"create" | "join" | "auth" | null>(null);
  const [code, setCode] = useState(""),
    [editing, setEditing] = useState(false),
    [days, setDays] = useState<Day[]>([]),
    [notes, setNotes] = useState(""),
    [dates, setDates] = useState("");
  const [syncWarning, setSyncWarning] = useState("");
  const [placeRoom, setPlaceRoom] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    let stopped = false;
    setSaved([]);
    if (session)
      db.from("tripcircle_saved_places")
        .select("destination_id")
        .then(({ data, error }) => {
          if (!stopped) {
            if (error)
              setError("Saved places could not load. Please try again later.");
            else setSaved((data || []).map((p) => p.destination_id));
          }
        });
    else setSaved([]);
    return () => {
      stopped = true;
    };
  }, [session?.user.id]);
  const modalRef = useRef<HTMLDivElement>(null),
    opener = useRef<HTMLElement | null>(null);
  const displayName =
    session?.user.user_metadata?.full_name ||
    session?.user.user_metadata?.name ||
    "";
  const roomId = route.startsWith("#room/") ? route.slice(6) : null;
  const selected = places.find((p) => route === `#place/${p.id}`);
  function open(kind: "create" | "join" | "auth") {
    opener.current = document.activeElement as HTMLElement;
    setError("");
    setModal(kind);
  }
  function close() {
    setModal(null);
    setError("");
    opener.current?.focus();
  }
  async function rpc(
    action: string,
    id: string | null = null,
    data: Record<string, unknown> = {},
  ) {
    const r = await db.rpc("tripcircle_rooms", {
      p_action: action,
      p_room: id,
      p_data: data,
    });
    if (r.error) throw r.error;
    return r.data;
  }
  async function refresh() {
    const [p, r] = await Promise.all([
      db.from("tripcircle_destinations").select("*").order("position"),
      rpc("list"),
    ]);
    if (p.error) throw p.error;
    setPlaces(p.data || []);
    setRooms(r);
  }
  async function refreshRoom() {
    if (!roomId) return;
    const current = await rpc("view", roomId);
    if (location.hash === `#room/${roomId}`) setRoom(current);
  }
  useEffect(() => {
    db.auth.getSession().then(({ data, error }) => {
      setSession(data.session);
      setAuthReady(true);
      if (error) setError("Sign-in could not finish. Please try again.");
    });
    const { data } = db.auth.onAuthStateChange((_event, s) => setSession(s));
    const controller = new AbortController();
    fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((s) => setGoogle(s.external?.google === true))
      .catch(() => setGoogle(false));
    return () => {
      data.subscription.unsubscribe();
      controller.abort();
    };
  }, []);
  useEffect(() => {
    const change = () => {
      setRoute(location.hash);
      setRoom(null);
      setEditing(false);
      setError("");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    let stopped = false;
    const run = () =>
      refresh()
        .then(() => {
          if (!stopped) setSyncWarning("");
        })
        .catch((e) => {
          if (!stopped) {
            if (/failed to fetch|network|load failed/i.test(e.message))
              setSyncWarning(
                "Connection interrupted. Showing the last loaded details; updates will retry automatically.",
              );
            else setError(e.message);
          }
        })
        .finally(() => {
          if (!stopped) setLoading(false);
        });
    run();
    const stopUpdates = subscribeUpdates(
      db,
      "tripcircle:public",
      false,
      run,
      () => setSyncWarning("Live updates are reconnecting. Refresh to retry."),
    );
    window.addEventListener("focus", run);
    return () => {
      stopped = true;
      stopUpdates();
      window.removeEventListener("focus", run);
    };
  }, []);
  useEffect(() => {
    if (!authReady) return;
    if (session) {
      rpc("mine")
        .then(setMine)
        .catch((e) => setError(e.message));
      try {
        const pending = JSON.parse(
          sessionStorage.getItem("tripcircle-next") || "null",
        );
        sessionStorage.removeItem("tripcircle-next");
        if (pending?.kind === "create") open("create");
        if (pending?.kind === "join") {
          if (pending.room) location.hash = `room/${pending.room}`;
          setCode(pending.code || "");
          open("join");
        }
        if (
          pending?.kind === "route" &&
          typeof pending.route === "string" &&
          /^#(search|places|trips|my-trips|room\/[a-f0-9-]+)$/.test(
            pending.route,
          )
        )
          location.hash = pending.route;
      } catch {
        /* Ignore an invalid saved draft; use the blank form. */
      }
    } else setMine([]);
  }, [session?.user.id, authReady]);
  useEffect(() => {
    if (!authReady || !roomId) return;
    let stopped = false;
    const run = () =>
      refreshRoom()
        .then(() => {
          if (!stopped) setSyncWarning("");
        })
        .catch((e) => {
          if (!stopped) {
            if (/failed to fetch|network|load failed/i.test(e.message))
              setSyncWarning(
                "Connection interrupted. Showing the last loaded details; updates will retry automatically.",
              );
            else setError(e.message);
          }
        });
    run();
    const fallback =
      import.meta.env.VITE_TRIPCIRCLE_REALTIME_ENABLED === "false"
        ? setInterval(run, 60000)
        : undefined;
    const stops = [
      session
        ? subscribeUpdates(
            db,
            `tripcircle:user:${session.user.id}`,
            true,
            run,
            () =>
              setSyncWarning(
                "Live updates are reconnecting. Refresh to retry.",
              ),
          )
        : () => {},
    ];
    let roomStop = () => {};
    rpc("view", roomId)
      .then((r) => {
        if (!stopped && r.plan && session)
          roomStop = subscribeUpdates(
            db,
            `tripcircle:room:${roomId}`,
            true,
            run,
            () =>
              setSyncWarning(
                "Live updates are reconnecting. Refresh to retry.",
              ),
          );
      })
      .catch(() => {});
    const focus = () => run();
    window.addEventListener("focus", focus);
    return () => {
      stopped = true;
      clearInterval(fallback);
      stops.forEach((stop) => stop());
      roomStop();
      window.removeEventListener("focus", focus);
    };
  }, [roomId, session?.user.id, authReady, Boolean(room?.plan)]);
  useEffect(() => {
    if (route === "#create") open("create");
    if (route === "#signin" && authReady) {
      if (session) {
        location.hash = sessionStorage.getItem("tripcircle-search-return")
          ? "search"
          : "my-trips";
        sessionStorage.removeItem("tripcircle-search-return");
      } else open("auth");
    }
    if (route.startsWith("#join/")) {
      setCode(route.slice(6));
      open("join");
    }
  }, [route, authReady, session?.user.id]);
  useEffect(() => {
    if (!modal) return;
    const node = modalRef.current;
    node?.querySelector<HTMLElement>("input,button")?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const all = Array.from(
        node?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea,a[href]",
        ) || [],
      );
      const first = all[0],
        last = all.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, [modal]);
  async function signIn(next?: Record<string, unknown>) {
    setError("");
    if (!google) {
      setError(
        "Google sign-in is not available yet. You can still explore all places.",
      );
      return;
    }
    setBusy(true);
    sessionStorage.setItem(
      "tripcircle-next",
      JSON.stringify(
        next || {
          kind: "route",
          route: sessionStorage.getItem("tripcircle-search-return")
            ? "#search"
            : location.hash,
        },
      ),
    );
    sessionStorage.removeItem("tripcircle-search-return");
    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL(import.meta.env.BASE_URL, location.origin).href,
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }
  async function act(action: string, data: Record<string, unknown> = {}) {
    if (!roomId || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await rpc(action, roomId, data);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      return false;
    }
    const message =
      action === "approve"
        ? "Request accepted. This person can now access the trip."
        : "Saved for your group.";
    if (action === "approve" || action === "reject")
      setRoom((current) =>
        current?.id === roomId
          ? {
              ...current,
              members: current.members?.map((member) =>
                member.id === data.user_id
                  ? {
                      ...member,
                      status: action === "approve" ? "approved" : "rejected",
                    }
                  : member,
              ),
            }
          : current,
      );
    setNotice(message);
    try {
      const results = await Promise.allSettled([
        refreshRoom(),
        refresh(),
        rpc("mine").then(setMine),
      ]);
      if (results.some((result) => result.status === "rejected"))
        setNotice(
          `${message} Some details could not refresh; they will update automatically when the connection recovers.`,
        );
      return true;
    } finally {
      setBusy(false);
    }
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = fields(e.currentTarget);
    sessionStorage.setItem("tripcircle-create-draft", JSON.stringify(data));
    if (!session) {
      await signIn({ kind: "create" });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await rpc("create", null, {
        ...data,
        capacity: Number(data.capacity),
      });
      sessionStorage.removeItem("tripcircle-create-draft");
      close();
      location.hash = `room/${r.id}`;
      await refresh();
      setMine(await rpc("mine"));
      setNotice("Your room is ready. Share the code with your group.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) {
      await signIn({ kind: "join", code, room: roomId });
      return;
    }
    const data = fields(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await rpc("join", code ? null : roomId, {
        name: data.name,
        code,
      });
      close();
      location.hash = `room/${r.id}`;
      await refreshRoom();
      setMine(await rpc("mine"));
      setNotice(
        r.status === "approved"
          ? "Welcome back to your trip."
          : r.status === "rejected"
            ? "The organizer declined this request."
            : "Request sent. The organizer will approve you.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied — ready to share in WhatsApp.");
    } catch {
      setNotice("Copy the link from your address bar to share.");
    }
  }
  function editPlan() {
    if (!room?.plan) return;
    setDays(room.plan.days.map((d) => ({ ...d })));
    setNotes(room.plan.notes);
    setDates(room.dates);
    setEditing(true);
  }
  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId) return;
    setBusy(true);
    setError("");
    try {
      await rpc("save_plan", roomId, { days, notes, dates });
      setEditing(false);
      await Promise.all([refreshRoom(), refresh()]);
      setNotice("Your itinerary is saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  let draft: Record<string, string> = {};
  try {
    draft = JSON.parse(
      sessionStorage.getItem("tripcircle-create-draft") || "{}",
    );
  } catch {
    /* Ignore an invalid saved draft; use the blank form. */
  }

  return (
    <div className="public-app">
      <MobileNav />
      <header>
        <a href="#" className="brand">
          <span className="brandmark" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="img">
              <path
                d="M24 5 43 39H5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinejoin="round"
              />
              <path
                d="M15 31c4-8 14-8 18 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <circle cx="24" cy="18" r="3" fill="currentColor" />
            </svg>
          </span>
          <span className="brand-word">
            Trip<span>Circle</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#places">Places</a>
          <a href="#search">Ask TripCircle</a>
          <a href="#trips">Trips</a>
          {session ? (
            <>
              <a href="#my-trips">My trips</a>
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await db.auth.signOut();
                  setBusy(false);
                  if (r.error) setError(r.error.message);
                  else {
                    setRoom(null);
                    setNotice("Signed out.");
                  }
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button onClick={() => open("auth")}>Sign in</button>
          )}
        </nav>
      </header>
      <main>
        {syncWarning && !modal && (
          <p className="auth-status" role="status">
            {syncWarning}
          </p>
        )}
        {error && !modal && (
          <div className="alert" role="alert">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {route === "#search" ? (
          <Suspense fallback={<p role="status">Opening place search…</p>}>
            <PlaceSearch
              places={places.length ? places : (catalogue as Place[])}
              signedIn={!!session}
              saved={saved}
              trips={mine
                .filter((r) => r.organizer)
                .map((r) => ({ id: r.id, title: r.title }))}
              addToTrip={async (place, trip) => {
                const detail = await rpc("view", trip);
                if (!detail.plan?.destinations.includes(place))
                  await rpc("shortlist", trip, { destination: place });
                location.hash = `room/${trip}`;
              }}
              ask={async (messages) => {
                const { data: auth } = await db.auth.getSession();
                const response = await fetch(
                  `${SUPABASE_URL}/functions/v1/place-search`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      apikey: SUPABASE_PUBLISHABLE_KEY,
                      Authorization: `Bearer ${auth.session?.access_token || ""}`,
                    },
                    body: JSON.stringify({ messages }),
                    signal: AbortSignal.timeout(40000),
                  },
                );
                const result = await response.json();
                if (!response.ok)
                  throw Error(
                    result.message || "Search is temporarily unavailable.",
                  );
                return result;
              }}
              save={async (id, remove) => {
                if (!session) throw Error("Sign in to save places.");
                const result = remove
                  ? await db
                      .from("tripcircle_saved_places")
                      .delete()
                      .eq("user_id", session.user.id)
                      .eq("destination_id", id)
                  : await db
                      .from("tripcircle_saved_places")
                      .insert({ user_id: session.user.id, destination_id: id });
                if (result.error && result.error.code !== "23505")
                  throw Error("Could not save this change. Please try again.");
                setSaved((current) =>
                  remove
                    ? current.filter((p) => p !== id)
                    : [...new Set([...current, id])],
                );
              }}
            />
          </Suspense>
        ) : route === "#demo" ? (
          <DemoRoom places={places} />
        ) : selected ? (
          <PlaceDetail
            selected={selected}
            placeRoom={placeRoom}
            copy={copy}
            create={() => open("create")}
          />
        ) : roomId ? (
          <>
            <a href="#my-trips" className="back">
              ← My trips
            </a>
            {!room ? (
              <div className="empty">
                <h2>
                  {session ? "Loading your trip…" : "Have a private room code?"}
                </h2>
                {!session && (
                  <>
                    <p>
                      Sign in to request access. Public trip previews are on the
                      homepage.
                    </p>
                    <button
                      onClick={() => {
                        setCode("");
                        open("join");
                      }}
                    >
                      Join with a code
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="room-heading">
                  <p className="eyebrow">
                    {room.visibility === "private"
                      ? "PRIVATE ROOM"
                      : "PUBLIC TRIP"}{" "}
                    · FROM {room.origin.toUpperCase()}
                  </p>
                  <h1>{room.title}</h1>
                  <p className="subtitle">{room.summary}</p>
                  <div className="chips">
                    <span>{room.dates || "Dates to decide"}</span>
                    <span>{room.budget || "Budget to decide"}</span>
                    <span>Up to {room.capacity} people</span>
                  </div>
                </div>
                {!room.plan ? (
                  <div className="callout">
                    <div>
                      <h2>
                        {room.status === "pending"
                          ? "Your request is with the organizer"
                          : room.status === "rejected"
                            ? "Request declined"
                            : "Want to be part of this trip?"}
                      </h2>
                      <p>
                        {room.status === "pending"
                          ? "The shared plan opens after approval. This page checks for updates automatically."
                          : room.status === "rejected"
                            ? "You do not have access to this room. Explore other trips from the homepage."
                            : "Ask to join. The organizer approves every participant."}
                      </p>
                    </div>
                    {!["pending", "rejected"].includes(room.status || "") && (
                      <button
                        onClick={() => {
                          setCode("");
                          open(session ? "join" : "auth");
                        }}
                      >
                        {session ? "Request to join" : "Sign in to join"}
                      </button>
                    )}
                  </div>
                ) : (
                  <Suspense
                    fallback={<p role="status">Opening your planner…</p>}
                  >
                    <RoomPlanner
                      room={{ ...room, plan: room.plan }}
                      places={places}
                      busy={busy}
                      editing={editing}
                      days={days}
                      notes={notes}
                      dates={dates}
                      editPlan={editPlan}
                      savePlan={savePlan}
                      setDays={setDays}
                      setNotes={setNotes}
                      setDates={setDates}
                      setEditing={setEditing}
                      act={act}
                      copy={copy}
                      setPlaceRoom={setPlaceRoom}
                      request={async (action, data = {}) => {
                        const r = await db.rpc("tripcircle_decisions", {
                          p_action: action,
                          p_room: room.id,
                          p_data: data,
                        });
                        if (r.error) throw r.error;
                        return r.data;
                      }}
                      onChanged={async () => {
                        await Promise.all([refreshRoom(), refresh()]);
                      }}
                    />
                  </Suspense>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {route === "#my-trips" ? (
              <>
                <div className="section-top">
                  <div>
                    <p className="eyebrow">YOUR NEXT ESCAPES</p>
                    <h1>My trips</h1>
                  </div>
                  <button onClick={() => open("create")}>Create a room</button>
                </div>
                {!session ? (
                  <div className="callout">
                    <p>
                      Sign in to find your rooms and joining requests on any
                      device.
                    </p>
                    <button onClick={() => open("auth")}>
                      Continue with Google
                    </button>
                  </div>
                ) : mine.length ? (
                  <div className="room-cards">
                    {mine.map((r) => (
                      <RoomCard key={r.id} room={r} />
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <h2>Your first trip starts here.</h2>
                    <p>Create a room or join using your group's code.</p>
                    <button
                      onClick={() => {
                        setCode("");
                        open("join");
                      }}
                    >
                      Join a room
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {route !== "#places" && route !== "#trips" && (
                  <>
                    <section className="public-hero">
                      <div className="hero-copy">
                        <p className="eyebrow">SMALL GROUPS. SLOWER DAYS.</p>
                        <h1>
                          A little farther.
                          <br />A lot more peaceful.
                        </h1>
                        <p>
                          Find quiet places, bring your people and turn “we
                          should go” into a plan.
                        </p>
                        <div className="hero-actions">
                          <button onClick={() => open("create")}>
                            Create a trip room ↗
                          </button>
                          <button
                            className="secondary"
                            onClick={() => {
                              setCode("");
                              open("join");
                            }}
                          >
                            Join with a code
                          </button>
                        </div>
                        <span className="hero-footnote">
                          Private rooms or public trips. You choose.
                        </span>
                      </div>
                      <figure>
                        <img
                          src={`${import.meta.env.BASE_URL}photos/bordi-beach-960.webp`}
                          srcSet={[480, 960, 1280]
                            .map(
                              (w) =>
                                `${import.meta.env.BASE_URL}photos/bordi-beach-${w}.webp ${w}w`,
                            )
                            .join(", ")}
                          sizes="(max-width: 700px) calc(100vw - 40px), 600px"
                          width={1280}
                          height={797}
                          fetchPriority="high"
                          alt="Quiet Bordi beach with rippled sand, calm sea and coastal trees"
                        />
                        <figcaption>
                          Bordi, Maharashtra · Sanjaybhagwat ·{" "}
                          <a href="#place/bordi">Photo credits &amp; licence</a>
                        </figcaption>
                      </figure>
                    </section>
                    <div className="how-it-works">
                      <span>
                        <b>01</b> Pick a place
                      </span>
                      <span>
                        <b>02</b> Gather your people
                      </span>
                      <span>
                        <b>03</b> Make a plan together
                      </span>
                    </div>
                  </>
                )}
                {route !== "#trips" && (
                  <section className="public-section" id="places">
                    <div className="section-top">
                      <div>
                        <p className="eyebrow">AHEAD OF THE USUAL WEEKEND</p>
                        <h2>Places worth slowing down for</h2>
                        <p className="muted">
                          From Ahmedabad. Hills, forests and quieter shores. No
                          resorts.
                        </p>
                      </div>
                      <div className="filters" aria-label="Filter destinations">
                        {["All", "Hills", "Forest", "Beach"].map((f) => (
                          <button
                            className={filter === f ? "active" : ""}
                            aria-pressed={filter === f}
                            key={f}
                            onClick={() => setFilter(f)}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    {loading ? (
                      <p className="empty">Loading places…</p>
                    ) : (
                      <div className="cards">
                        {places
                          .filter(
                            (p) => filter === "All" || p.landscape === filter,
                          )
                          .map((p) => (
                            <DestinationCard key={p.id} place={p} />
                          ))}
                      </div>
                    )}
                  </section>
                )}
                {route !== "#places" && rooms.length > 0 && (
                  <section className="public-section" id="trips">
                    <div className="section-top">
                      <div>
                        <p className="eyebrow">GOOD PLANS, NEW PEOPLE</p>
                        <h2>Discover public trips</h2>
                        <p className="muted">
                          Browse a preview. Request to join. The organizer
                          approves every member.
                        </p>
                      </div>
                      <button onClick={() => open("create")}>
                        Start a trip
                      </button>
                    </div>
                    {rooms.length ? (
                      <div className="room-cards">
                        {rooms.map((r) => (
                          <RoomCard key={r.id} room={r} />
                        ))}
                      </div>
                    ) : (
                      <div className="public-empty">
                        <span>↗</span>
                        <div>
                          <h3>The next good trip could be yours.</h3>
                          <p>
                            No public trips yet. Create a room and make it
                            discoverable whenever you're ready.
                          </p>
                        </div>
                        <button onClick={() => open("create")}>
                          Create a room
                        </button>
                      </div>
                    )}
                  </section>
                )}
                <section className="bottom-cta">
                  <p className="eyebrow">ONE LINK. ONE SHARED PLAN.</p>
                  <h2>
                    Fewer messages.
                    <br />
                    More memories.
                  </h2>
                  <p>
                    Pick dates, compare stays and travel, and keep the final
                    plan in one place.
                  </p>
                  <button onClick={() => open("create")}>
                    Bring your group together
                  </button>
                </section>
              </>
            )}
          </>
        )}
        <footer>
          <p>
            TripCircle · Made for small groups and peaceful escapes.
            <br />
            Destination research: 2 Oct 2026. Confirm access, transport and
            stays before booking.
          </p>
          <div>
            <a
              href="https://github.com/Siddhant-Gawai/tripcircle"
              target="_blank"
              rel="noreferrer"
            >
              GitHub ↗
            </a>
          </div>
        </footer>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            ref={modalRef}
          >
            <button className="close" aria-label="Close dialog" onClick={close}>
              ×
            </button>
            {modal === "auth" ? (
              <>
                <p className="eyebrow">WELCOME TO TRIPCIRCLE</p>
                <h2 id="dialog-title">Your trips, wherever you are.</h2>
                <p>
                  Use Google to create a room, request to join and return from
                  any device.
                </p>
                <button
                  disabled={busy || google === null}
                  className="primary google-button"
                  onClick={() =>
                    signIn(roomId ? { kind: "join", room: roomId } : undefined)
                  }
                >
                  {busy ? "Opening Google…" : "Continue with Google"}
                </button>
                <p className="small">
                  No SMS, OTP or new password. Your account email is never shown
                  in trip previews.
                </p>
              </>
            ) : modal === "create" ? (
              <form onSubmit={create}>
                <p className="eyebrow">MAKE IT HAPPEN</p>
                <h2 id="dialog-title">Create a trip room</h2>
                <label>
                  Your display name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={60}
                    defaultValue={draft.name || displayName}
                  />
                </label>
                <label>
                  Trip name
                  <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={draft.title}
                    placeholder="A quiet weekend in the hills"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Starting from
                    <input
                      name="origin"
                      required
                      minLength={2}
                      maxLength={100}
                      defaultValue={draft.origin || "Ahmedabad"}
                    />
                  </label>
                  <label>
                    Group size
                    <input
                      name="capacity"
                      type="number"
                      required
                      min={2}
                      max={50}
                      defaultValue={draft.capacity || 7}
                    />
                  </label>
                </div>
                <label>
                  A short introduction
                  <textarea
                    name="summary"
                    maxLength={1000}
                    defaultValue={draft.summary}
                    placeholder="Where we're thinking of going and the kind of trip we want…"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Dates
                    <input
                      name="dates"
                      maxLength={100}
                      defaultValue={draft.dates}
                      placeholder="30 Oct – 1 Nov / to decide"
                    />
                  </label>
                  <label>
                    Budget per person
                    <input
                      name="budget"
                      maxLength={100}
                      defaultValue={draft.budget}
                      placeholder="₹5,000 approx. / to decide"
                    />
                  </label>
                </div>
                <label>
                  Who can find it?
                  <select
                    name="visibility"
                    defaultValue={draft.visibility || "private"}
                  >
                    <option value="private">Private · join with a code</option>
                    <option value="public">
                      Public · anyone can request to join
                    </option>
                  </select>
                </label>
                <button disabled={busy || !authReady} className="primary">
                  {busy
                    ? "Creating…"
                    : session
                      ? "Create room"
                      : "Continue with Google & create"}
                </button>
                <p className="small">
                  All joining requests need your approval. You can change
                  visibility later.
                </p>
              </form>
            ) : (
              <form onSubmit={join}>
                <p className="eyebrow">YOUR PEOPLE ARE WAITING</p>
                <h2 id="dialog-title">
                  {room?.visibility === "public" && !code
                    ? "Request to join"
                    : "Join a trip room"}
                </h2>
                {(!roomId || room?.visibility !== "public" || code) && (
                  <label>
                    Room code
                    <input
                      name="code"
                      value={code}
                      onChange={(e) =>
                        setCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                            .slice(0, 12),
                        )
                      }
                      required
                      pattern="[A-F0-9]{12}"
                      maxLength={12}
                      placeholder="12-character room code"
                      autoComplete="off"
                    />
                  </label>
                )}
                <label>
                  Your display name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={60}
                    defaultValue={displayName}
                    autoComplete="name"
                  />
                </label>
                <button className="primary" disabled={busy || !authReady}>
                  {busy
                    ? "Sending…"
                    : session
                      ? "Send joining request"
                      : "Continue with Google"}
                </button>
                <p className="small">
                  The organizer approves your request before you can view the
                  shared plan.
                </p>
              </form>
            )}
            {google === false && (
              <p className="auth-status" role="status">
                Sign-in is being connected. You can explore places now; creating
                and joining rooms will open once it's ready.
              </p>
            )}
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
