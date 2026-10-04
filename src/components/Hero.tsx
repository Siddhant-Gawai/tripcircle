export default function Hero({
  create,
  join,
}: {
  create: () => void;
  join: () => void;
}) {
  return (
    <section className="public-hero">
      <div className="hero-copy">
        <p className="eyebrow">SMALL GROUPS. SLOWER DAYS.</p>
        <h1>
          A little farther.
          <br />A lot more peaceful.
        </h1>
        <p>
          Find quiet places, bring your people and turn “we should go” into a
          plan.
        </p>
        <div className="hero-actions">
          <button onClick={() => create()}>Create a trip room ↗</button>
          <button
            className="secondary"
            onClick={() => {
              join();
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
  );
}
