const icons = [
  "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  "m12 3 9 9-9 9-9-9Z",
  "M4 3h16v18H4ZM8 7h8M8 12h8M8 17h8",
  "M12 4v16M4 12h16",
];
export default function MobileNav() {
  const base = import.meta.env.BASE_URL;
  return (
    <nav className="mobile-tabs" aria-label="Mobile navigation">
      {[
        [base, "Home"],
        [`${base}#places`, "Explore"],
        [`${base}#my-trips`, "My rooms"],
        [`${base}#create`, "Create"],
      ].map(([href, label], i) => (
        <a href={href} key={label}>
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path d={icons[i]} />
          </svg>
          {label}
        </a>
      ))}
    </nav>
  );
}
