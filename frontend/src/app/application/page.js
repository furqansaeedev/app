"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function validate({ fullName, email, phone }) {
  const errors = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!fullName.trim()) {
    errors.fullName = "Full name is required.";
  } else if (fullName.trim().length < 2) {
    errors.fullName = "Full name must be at least 2 characters.";
  }

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!emailRegex.test(email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (!phone.trim()) {
    errors.phone = "Phone number is required.";
  } else if (!/^[+\d][\d\s\-()]{6,19}$/.test(phone.trim())) {
    errors.phone = "Please enter a valid phone number.";
  }

  return errors;
}

export default function ApplicationPage() {
  const router = useRouter();

  const [authState, setAuthState] = useState("loading"); // loading | authed | unauthed
  const [user, setUser] = useState(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Auth check on mount. Unauthenticated users are sent to /login.
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setAuthState("unauthed");
            router.replace("/login");
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setUser(data.user || null);
          setAuthState("authed");
          // Prefill from the authenticated user
          setForm((prev) => ({
            ...prev,
            fullName: prev.fullName || data.user?.name || "",
            email: prev.email || data.user?.email || "",
          }));
        }
      } catch {
        if (!cancelled) {
          setAuthState("unauthed");
          router.replace("/login");
        }
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
    setSuccess("");

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          message: form.message.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setServerError(
            data.error || "You have already submitted an application."
          );
        } else if (res.status === 401) {
          setServerError("Your session has expired. Please log in again.");
          router.replace("/login");
        } else {
          setServerError(
            data.error || "Could not submit your application. Please try again."
          );
        }
        return;
      }

      setSuccess(
        "Application submitted successfully! A confirmation has been sent to our team."
      );
      setForm({
        fullName: user?.name || "",
        email: user?.email || "",
        phone: "",
        message: "",
      });
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore — we're redirecting anyway.
    } finally {
      router.replace("/login");
    }
  }

  if (authState === "loading") {
    return (
      <main className="app-main">
        <div className="app-loading-screen">
          <span className="app-spinner" aria-hidden="true" />
          Checking your session…
        </div>
      </main>
    );
  }

  if (authState === "unauthed") {
    return (
      <main className="app-main">
        <div className="app-loading-screen">
          <span className="app-spinner" aria-hidden="true" />
          Redirecting to login…
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <div className="app-auth-wrapper" style={{ maxWidth: "640px" }}>
        <div className="app-card">
          <div className="app-page-header">
            <div>
              <h1>Application Form</h1>
              <p>Tell us a little about yourself. Fields marked * are required.</p>
            </div>
            {user && (
              <div className="app-user-badge">
                Signed in as <strong>{user.name}</strong>
              </div>
            )}
          </div>

          {serverError && (
            <div className="app-alert app-alert-error" role="alert">
              {serverError}
            </div>
          )}
          {success && (
            <div className="app-alert app-alert-success" role="status">
              {success}
            </div>
          )}

          <form className="app-form" onSubmit={handleSubmit} noValidate>
            <div className="app-form-row">
              <label className="app-label" htmlFor="fullName">
                Full Name <span className="app-required">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className="app-input"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Jane Doe"
                autoComplete="name"
                disabled={loading}
              />
              {fieldErrors.fullName && (
                <p className="app-field-error">{fieldErrors.fullName}</p>
              )}
            </div>

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
              <label className="app-label" htmlFor="phone">
                Phone Number <span className="app-required">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="app-input"
                value={form.phone}
                onChange={handleChange}
                placeholder="+1 555 123 4567"
                autoComplete="tel"
                disabled={loading}
              />
              {fieldErrors.phone && (
                <p className="app-field-error">{fieldErrors.phone}</p>
              )}
            </div>

            <div className="app-form-row">
              <label className="app-label" htmlFor="message">
                Message{" "}
                <span style={{ color: "#475569", fontWeight: 400 }}>
                  (optional)
                </span>
              </label>
              <textarea
                id="message"
                name="message"
                className="app-textarea"
                value={form.message}
                onChange={handleChange}
                placeholder="Anything you'd like us to know?"
                maxLength={2000}
                disabled={loading}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="submit"
                className="app-btn app-btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="app-spinner" aria-hidden="true" />
                    Submitting…
                  </>
                ) : (
                  "Submit Application"
                )}
              </button>
              <button
                type="button"
                className="app-btn app-btn-secondary"
                onClick={handleLogout}
                disabled={loading}
              >
                Log Out
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}