"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function validate({ email, password }) {
  const errors = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!emailRegex.test(email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  }

  return errors;
}

export default function LoginPage() {
  const router = useRouter();

  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) setServerError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError("");

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(data.error || "Invalid email or password.");
        return;
      }

      router.push("/application");
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-main">
      <div className="app-auth-wrapper">
        <div className="app-card">
          <h1>Welcome back</h1>
          <p className="app-subtitle">
            Log in to continue to your application.
          </p>

          {serverError && (
            <div className="app-alert app-alert-error" role="alert">
              {serverError}
            </div>
          )}

          <form className="app-form" onSubmit={handleSubmit} noValidate>
            <div className="app-form-row">
              <label className="app-label" htmlFor="email">
                Email Address <span className="app-required">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="app-input"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
              />
              {fieldErrors.email && (
                <p className="app-field-error">{fieldErrors.email}</p>
              )}
            </div>

            <div className="app-form-row">
              <label className="app-label" htmlFor="password">
                Password <span className="app-required">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="app-input"
                value={form.password}
                onChange={handleChange}
                placeholder="Your password"
                autoComplete="current-password"
                disabled={loading}
              />
              {fieldErrors.password && (
                <p className="app-field-error">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              className="app-btn app-btn-primary app-btn-block"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="app-spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Log In"
              )}
            </button>
          </form>

          <p className="app-auth-footer">
            Don&apos;t have an account?{" "}
            <Link href="/register">Create one</Link>
          </p>
        </div>
      </div>
    </main>
  );
}