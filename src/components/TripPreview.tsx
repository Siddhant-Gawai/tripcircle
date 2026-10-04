export default function TripPreview() {
  return (
    <section className="bottom-cta">
      <p className="eyebrow">ONE LINK. ONE SHARED PLAN.</p>
      <h2>
        Fewer messages.
        <br />
        More memories.
      </h2>
      <p>
        Pick dates, compare stays and travel, and keep the final plan in one
        place.
      </p>
      <div className="room-preview" aria-label="Illustration of a trip room">
        <div>
          <span className="tag">Sample plan</span>
          <h3>A quiet weekend in the hills</h3>
          <p>3 days · 6 friends · Small homestay</p>
        </div>
        <div>
          <strong>Friday · Arrive & settle in</strong>
          <span>17:00 · A sunset walk</span>
        </div>
        <div>
          <strong>Saturday · Take it slowly</strong>
          <span>09:00 · Breakfast, a valley walk & local food</span>
        </div>
        <div>
          <strong>Bring along</strong>
          <span>✓ Water bottles &nbsp; ✓ First-aid kit</span>
        </div>
      </div>
      <a className="primary" href="#demo">
        Explore a demo room →
      </a>
    </section>
  );
}
