"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  // Best-effort auth check so the CTA button can say "Apply Now" or "Continue Application"
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch {
        // Not logged in or API not ready — that's fine on the landing page.
      } finally {
        if (!cancelled) setCheckedAuth(true);
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav-inner">
          <Link href="/" className="app-logo">
            ApplyHub
          </Link>
          <div className="app-nav-links">
            <Link href="/" className="app-nav-link is-active">
              Home
            </Link>
            <Link href="/register" className="app-nav-link">
              Register
            </Link>
            <Link href="/login" className="app-nav-link">
              Login
            </Link>
            <Link href="/application" className="app-btn app-btn-primary">
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      <main className="app-main">
        <section className="app-hero">
          <h1>
            Submit your application <br />
            <span className="app-hero-highlight">in minutes.</span>
          </h1>
          <p>
            ApplyHub is a secure application portal. Create an account, log in,
            and submit your application. You&apos;ll get instant confirmation —
            and so will our team.
          </p>

          <div className="app-hero-actions">
            {checkedAuth && user ? (
              <Link href="/application" className="app-btn app-btn-primary">
                Continue Application →
              </Link>
            ) : (
              <Link href="/register" className="app-btn app-btn-primary">
                Get Started — Register
              </Link>
            )}
            <Link href="/login" className="app-btn app-btn-secondary">
              I already have an account
            </Link>
          </div>
        </section>

        <section className="app-features">
          <article className="app-feature-card">
            <div className="app-feature-icon">1</div>
            <h3>Create an account</h3>
            <p>
              Register with your name and email. Your password is hashed with
              bcrypt before it ever touches the database.
            </p>
          </article>

          <article className="app-feature-card">
            <div className="app-feature-icon">2</div>
            <h3>Log in securely</h3>
            <p>
              Authentication uses signed JWTs stored in HTTP-only cookies, so
              your session never leaks to client-side JavaScript.
            </p>
          </article>

          <article className="app-feature-card">
            <div className="app-feature-icon">3</div>
            <h3>Submit &amp; get notified</h3>
            <p>
              Fill in the application form and submit. Our team is notified by
              email instantly, and you&apos;ll see a success confirmation here.
            </p>
          </article>
        </section>
      </main>
    </>
  );
}