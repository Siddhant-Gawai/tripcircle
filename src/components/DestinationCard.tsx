import type { Place } from "../types";
import { photo, photoSet } from "../place-utils";
export default function DestinationCard({ place: p }: { place: Place }) {
  return (
    <article className="card" key={p.id}>
      <a
        className="card-link"
        href={`${import.meta.env.BASE_URL}places/${p.id}/`}
      >
        {p.details?.photos?.[0] ? (
          <img
            className="card-photo"
            src={photo(p.details.photos[0])}
            srcSet={photoSet(p.details.photos[0])}
            sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1000px) 45vw, 360px"
            decoding="async"
            alt={p.details.photos[0].caption}
            loading="lazy"
          />
        ) : (
          <div className="card-photo no-photo">
            Forest trails. Quiet days.
            <span>Explore the official photo gallery inside</span>
          </div>
        )}
        <div className="card-content">
          <span className="tag">{p.landscape}</span>
          <h3>{p.name}</h3>
          <p className="description">{p.summary}</p>
          <p className="card-meta">
            {p.journey} · {p.duration}
          </p>
          <span className="open-place">Photos, viewpoints & stays →</span>
        </div>
      </a>
    </article>
  );
}
