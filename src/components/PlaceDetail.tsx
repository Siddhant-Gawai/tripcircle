import type { Place } from "../types";
import { Link, maps, photo, photoSet, photoCaption } from "../place-utils";
export default function PlaceDetail({
  selected,
  placeRoom,
  copy,
  create,
}: {
  selected: Place;
  placeRoom?: string | null;
  copy: (text: string) => void;
  create: () => void;
}) {
  return (
    <>
      <a className="back" href={placeRoom ? `#room/${placeRoom}` : "#places"}>
        {placeRoom ? "← Back to your trip" : "← Back to places"}
      </a>
      <div className="detail-heading">
        <div>
          <p className="eyebrow">{selected.landscape} · FROM AHMEDABAD</p>
          <h1>{selected.name}</h1>
          <p className="subtitle">{selected.summary}</p>
        </div>
        <button onClick={() => copy(location.href)}>Share this place</button>
      </div>
      {selected.details?.photos?.length ? (
        <div className="gallery">
          {selected.details.photos.map((p) => (
            <figure key={p.file}>
              <img
                src={photo(p)}
                srcSet={photoSet(p)}
                sizes="(max-width: 700px) calc(100vw - 40px), 700px"
                decoding="async"
                alt={photoCaption(p)}
              />
              <figcaption>{p.caption}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="gallery-placeholder">
          <h2>A forest escape</h2>
          <p>See authentic photos on the official tourism gallery.</p>
          <Link url={selected.details?.gallery_url || selected.source_url}>
            Open gallery
          </Link>
        </div>
      )}
      <div className="detail-grid">
        <div>
          <section className="detail-section">
            <p className="eyebrow">WORTH THE DETOUR</p>
            <h2>Viewpoints & slow outings</h2>
            <div className="spots">
              {selected.details?.spots?.map((s, i) => (
                <article key={s.name}>
                  <span className="spot-number">0{i + 1}</span>
                  <div>
                    <h3>{s.name}</h3>
                    <p>{s.summary}</p>
                    <Link url={maps(s.name + " " + selected.name)}>
                      Find on map
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <h2>A simple starting plan</h2>
            <p className="preserve">{selected.itinerary}</p>
            <p className="caveat">{selected.caveat}</p>
          </section>
        </div>
        <aside>
          <section className="trip-facts">
            <span className="label">FROM AHMEDABAD, ONE WAY</span>
            <strong>{selected.journey}</strong>
            <span className="label">TIME TO TAKE</span>
            <strong>{selected.duration}</strong>
            <Link
              url={`https://www.google.com/maps/dir/?api=1&origin=Ahmedabad&destination=${encodeURIComponent(selected.name)}`}
            >
              Check route
            </Link>
          </section>
          <section className="detail-section stays">
            <p className="eyebrow">SMALL STAYS, NO RESORTS</p>
            <h2>Where to stay</h2>
            {selected.details?.stays?.map((s) => (
              <article key={s.name}>
                <h3>{s.name}</h3>
                <p>{s.summary}</p>
                <Link url={s.url}>View stay / contact</Link>
              </article>
            ))}
            <p className="small">
              Research leads, not bookings. Confirm location, rooms, meals and
              total price before paying.
            </p>
          </section>
          <section className="detail-section">
            <h2>Useful links</h2>
            <Link url={selected.source_url}>Tourism guide</Link>
            <Link url={maps(selected.name)}>Explore nearby</Link>
          </section>
        </aside>
      </div>
      {!!selected.details?.photos?.length && (
        <details className="credits">
          <summary>Photo credits & licences</summary>
          {selected.details.photos.map((p) => (
            <p key={p.file}>
              {p.caption} — {p.author}.{" "}
              <Link url={p.source}>Original photo</Link>
              <Link url={p.license_url}>{p.license}</Link>Images displayed
              cropped.
            </p>
          ))}
        </details>
      )}
      <div className="place-sticky-cta">
        <button className="primary" onClick={create}>
          Create a trip room
        </button>
      </div>
      <div className="callout">
        <h2>Make this a trip with your people.</h2>
        <button onClick={() => create()}>Create a trip room</button>
      </div>
    </>
  );
}
