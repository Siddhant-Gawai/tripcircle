export default function Header() {
  return (
    <header>
      <a href={import.meta.env.BASE_URL} className="brand">
        <span className="brandmark" aria-hidden="true">
          <svg viewBox="0 0 48 48">
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
        <a href="#trips">Trips</a>
        <a href="#my-trips">My trips</a>
        <a className="text-button" href="#signin">
          Sign in
        </a>
      </nav>
    </header>
  );
}
