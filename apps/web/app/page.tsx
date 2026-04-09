import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero-card">
        <p className="eyebrow">Target web slice</p>
        <h1>OneApp account access, rebuilt on the target stack.</h1>
        <p className="lede">
          This first migration slice keeps scope narrow: register, sign in, and land on a protected dashboard shell while the wider prototype remains active.
        </p>
        <div className="actions">
          <Link className="button button-primary" href="/register">Create account</Link>
          <Link className="button button-secondary" href="/login">Sign in</Link>
        </div>
      </section>
    </main>
  );
}
