import MobileNav from "./components/MobileNav";
import { lazy, Suspense, useEffect, useState } from "react";
import catalogue from "./catalogue.json";
import type { Place, Room } from "./types";
import { readPlaces, readRooms } from "./public-api";
import Header from "./components/Header";
import Hero from "./components/Hero";
import DestinationCard from "./components/DestinationCard";
import PlaceDetail from "./components/PlaceDetail";
import RoomList from "./components/RoomList";
import TripPreview from "./components/TripPreview";
import DemoRoom from "./components/DemoRoom";
const initialRoute = () =>
  location.hash ||
  (location.pathname.match(/\/places\/([^/]+)\/?$/)
    ? `#place/${location.pathname.match(/\/places\/([^/]+)\/?$/)![1]}`
    : "");
const PlannerApp = lazy(() => import("./PlannerApp"));
function needsPlanner(route: string) {
  return (
    /^#(room\/|join\/|my-trips|create|signin)/.test(route) ||
    new URLSearchParams(location.search).has("code")
  );
}
export default function PublicShell() {
  const [route, setRoute] = useState(initialRoute),
    [plannerActive, setPlannerActive] = useState(() =>
      needsPlanner(location.hash),
    );
  const [places, setPlaces] = useState<Place[]>(catalogue as Place[]),
    [rooms, setRooms] = useState<Room[]>([]),
    [filter, setFilter] = useState("All"),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const change = () => {
      setRoute(initialRoute());
      if (needsPlanner(location.hash)) setPlannerActive(true);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (plannerActive) return;
    let stopped = false;
    const refresh = () => {
      void readPlaces()
        .then((data) => {
          if (!stopped && data.length) setPlaces(data);
        })
        .catch(() => {});
      void readRooms()
        .then((data) => {
          if (!stopped) setRooms(data);
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      stopped = true;
      window.removeEventListener("focus", refresh);
    };
  }, [plannerActive, route]);
  if (plannerActive)
    return (
      <Suspense
        fallback={
          <div className="public-app">
            <MobileNav />
            <Header />
            <main>
              <p role="status">Opening your trips…</p>
            </main>
          </div>
        }
      >
        <PlannerApp />
      </Suspense>
    );
  const selected = places.find((p) => route === `#place/${p.id}`),
    create = () => {
      location.hash = "create";
    },
    join = () => {
      location.hash = "join/";
    };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied — ready to share in WhatsApp.");
    } catch {
      setNotice("Copy the link from your address bar to share.");
    }
  };
  return (
    <div className="public-app">
      <MobileNav />
      <Header />
      <main>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {route === "#demo" ? (
          <DemoRoom places={places} />
        ) : selected ? (
          <PlaceDetail selected={selected} copy={copy} create={create} />
        ) : (
          <>
            {route !== "#places" && route !== "#trips" && (
              <>
                <Hero create={create} join={join} />
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
                        key={f}
                        aria-pressed={filter === f}
                        className={filter === f ? "active" : ""}
                        onClick={() => setFilter(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="cards">
                  {places
                    .filter((p) => filter === "All" || p.landscape === filter)
                    .map((place) => (
                      <DestinationCard key={place.id} place={place} />
                    ))}
                </div>
              </section>
            )}
            {route !== "#places" && <RoomList rooms={rooms} />}
            {route === "#trips" && !rooms.length && (
              <section className="public-section">
                <h1>Make the next trip yours.</h1>
                <p>
                  Start a private room for your friends, or publish a trip
                  others can request to join.
                </p>
                <a href="#create" className="primary">
                  Create a trip room →
                </a>
              </section>
            )}
            <TripPreview />
          </>
        )}
        <footer>
          <p>
            TripCircle · Made for small groups and peaceful escapes.
            <br />
            Destination research: 2 Oct 2026. Confirm access, transport and
            stays before booking.
          </p>
          <a
            href="https://github.com/Siddhant-Gawai/tripcircle"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </footer>
      </main>
    </div>
  );
}
