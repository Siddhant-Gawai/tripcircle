import { useEffect, useRef, useState } from "react";
import type { Place } from "../types";
import DestinationCard from "./DestinationCard";
import "../search.css";

type Reply = { message: string; places: { id: string; reason: string }[] };
type Turn = { role: "user" | "assistant"; content: string };
type Props = {
  places: Place[];
  signedIn?: boolean;
  saved?: string[];
  ask?: (messages: Turn[]) => Promise<Reply>;
  save?: (id: string, remove: boolean) => Promise<void>;
  trips?: { id: string; title: string }[];
  addToTrip?: (place: string, trip: string) => Promise<void>;
};
export default function PlaceSearch({
  places,
  signedIn,
  saved = [],
  ask,
  save,
  trips = [],
  addToTrip,
}: Props) {
  const [query, setQuery] = useState(""),
    [turns, setTurns] = useState<Turn[]>([]);
  const [results, setResults] = useState<Reply["places"]>([]),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [saving, setSaving] = useState<string | null>(null);
  const [catalogueOnly, setCatalogueOnly] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  function signIn() {
    sessionStorage.setItem("tripcircle-search-return", "yes");
    location.hash = "signin";
  }
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns, busy]);
  async function search(text: string) {
    if (busy || !text.trim()) return;
    const next: Turn[] = [
      ...turns,
      { role: "user" as const, content: text.trim() },
    ].slice(-8);
    setTurns(next);
    setResults([]);
    setQuery("");
    setError("");
    setBusy(true);
    try {
      let reply: Reply;
      if (signedIn && ask && !catalogueOnly) reply = await ask(next);
      else {
        const words = text.toLowerCase().match(/[a-z]{3,}/g) || [];
        const categories = [
          {
            name: "Beach",
            pattern: /\b(beach(?:es)?|coast(?:al)?|sea(?:side)?|shores?)\b/,
          },
          { name: "Forest", pattern: /\b(forests?|waterfalls?|woods?)\b/ },
          { name: "Hills", pattern: /\b(hills?|mountains?|valleys?)\b/ },
        ]
          .filter((category) => category.pattern.test(text.toLowerCase()))
          .map((category) => category.name);
        const matches = places.filter((p) =>
          categories.length
            ? categories.includes(p.landscape)
            : words.some((w) =>
                `${p.name} ${p.summary} ${p.landscape}`
                  .toLowerCase()
                  .includes(w),
              ),
        );
        reply = {
          message: matches.length
            ? "Here are catalogue matches. Prices and availability need confirmation."
            : "No catalogue match yet. Try beach, hills, forest or a destination name.",
          places: matches.map((p) => ({ id: p.id, reason: p.summary })),
        };
      }
      if (typeof reply.message !== "string" || !Array.isArray(reply.places))
        throw Error("The search response could not be read. Please try again.");
      setResults(
        reply.places.filter((p) => places.some((place) => place.id === p.id)),
      );
      setTurns([...next, { role: "assistant", content: reply.message }]);
    } catch (e) {
      setTurns(turns);
      setQuery(text.trim());
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="place-search public-section"
      aria-labelledby="place-search-title"
    >
      <p className="eyebrow">YOUR NEXT ESCAPE</p>
      <h1 id="place-search-title">Find a place together</h1>
      <p className="muted">
        Tell us what you have in mind. Search our five researched destinations
        from Ahmedabad, then save your favourites.
      </p>
      {!signedIn && (
        <p className="auth-status">
          Catalogue search is ready.{" "}
          <a href="#signin" onClick={signIn}>
            Sign in
          </a>{" "}
          for AI chat and saved places.
        </p>
      )}
      {signedIn && (
        <button
          aria-pressed={catalogueOnly}
          onClick={() => {
            setCatalogueOnly(!catalogueOnly);
            setError("");
            setTurns([]);
            setResults([]);
          }}
          disabled={busy}
        >
          {catalogueOnly ? "Switch to AI chat" : "Use catalogue search"}
        </button>
      )}
      <div className="search-prompts">
        {["Quiet beaches", "Hills for three days", "Forest and waterfalls"].map(
          (text) => (
            <button
              key={text}
              disabled={busy}
              onClick={() => void search(text)}
            >
              {text}
            </button>
          ),
        )}
      </div>
      <div
        className="search-conversation"
        role="log"
        aria-label="Place search conversation"
        aria-live="polite"
      >
        {turns.map((turn, i) => (
          <p className={`search-turn ${turn.role}`} key={i}>
            <strong>{turn.role === "user" ? "You" : "TripCircle"}</strong>
            {turn.content}
          </p>
        ))}
        {busy && <p role="status">Finding places…</p>}
        <div ref={end} />
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <form
        className="search-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <label htmlFor="place-query">What kind of trip would you like?</label>
        <textarea
          id="place-query"
          required
          maxLength={600}
          rows={2}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="A quiet beach from Ahmedabad for three days…"
        />
        <button className="primary" disabled={busy || !query.trim()}>
          {busy ? "Searching…" : "Find places"}
        </button>
      </form>
      {!!results.length && (
        <div className="cards search-results">
          {results.map((result) => {
            const place = places.find((p) => p.id === result.id)!;
            return (
              <div key={place.id}>
                <DestinationCard place={place} />
                <p className="search-reason">{result.reason}</p>
                <button
                  disabled={saving !== null}
                  onClick={async () => {
                    if (!signedIn || !save) {
                      signIn();
                      return;
                    }
                    setSaving(place.id);
                    setError("");
                    try {
                      await save(place.id, saved.includes(place.id));
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setSaving(null);
                    }
                  }}
                >
                  {saving === place.id
                    ? "Saving…"
                    : saved.includes(place.id)
                      ? "Remove saved place"
                      : "Save place"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {signedIn && (
        <section className="saved-places">
          <h2>Saved places</h2>
          {saved.length ? (
            <>
              <div className="cards">
                {places
                  .filter((p) => saved.includes(p.id))
                  .map((p) => (
                    <div key={p.id}>
                      <DestinationCard place={p} />
                      <button
                        disabled={saving !== null}
                        onClick={async () => {
                          setSaving(p.id);
                          setError("");
                          try {
                            await save?.(p.id, true);
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setSaving(null);
                          }
                        }}
                      >
                        Remove saved place
                      </button>
                    </div>
                  ))}
              </div>
              {trips.length ? (
                <form
                  className="search-compose"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    setSaving("trip");
                    setError("");
                    try {
                      await addToTrip?.(
                        String(data.get("place")),
                        String(data.get("trip")),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setSaving(null);
                    }
                  }}
                >
                  <h3>Add a saved place to your trip</h3>
                  <label>
                    Saved destination
                    <select name="place">
                      {places
                        .filter((p) => saved.includes(p.id))
                        .map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Your trip
                    <select name="trip">
                      {trips.map((t) => (
                        <option value={t.id} key={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={saving !== null}>
                    Add to trip shortlist
                  </button>
                </form>
              ) : (
                <p>
                  <a href="#create">Create a trip room</a> to make a shared
                  shortlist.
                </p>
              )}
            </>
          ) : (
            <p className="muted">
              Save a result to return to it on any device.
            </p>
          )}
        </section>
      )}
      <p className="small muted">
        Catalogue recommendations, not live web search. Confirm travel times,
        seasonal access, prices and stays before booking.
      </p>
    </section>
  );
}
