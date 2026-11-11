"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function validate({ fullName, email, password, confirmPassword }) {
  const errors = {};

  if (!fullName.trim()) {
    errors.fullName = "Full name is required.";
  } else if (fullName.trim().length < 2) {
    errors.fullName = "Full name must be at least 2 characters.";
  } else if (fullName.trim().length > 100) {
    errors.fullName = "Full name must be at most 100 characters.";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!emailRegex.test(email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  } else if (password.length > 72) {
    errors.password = "Password must be at most 72 characters.";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");
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
    setSuccess("");

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(data.error || "Registration failed. Please try again.");
        return;
      }

      setSuccess("Account created successfully. Redirecting to login…");
      setForm({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        router.push("/login");
      }, 1200);
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
          <h1>Create your account</h1>
          <p className="app-subtitle">
            Register once to submit your application securely.
          </p>

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
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={loading}
              />
              {fieldErrors.password && (
                <p className="app-field-error">{fieldErrors.password}</p>
              )}
            </div>

            <div className="app-form-row">
              <label className="app-label" htmlFor="confirmPassword">
                Confirm Password <span className="app-required">*</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className="app-input"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={loading}
              />
              {fieldErrors.confirmPassword && (
                <p className="app-field-error">
                  {fieldErrors.confirmPassword}
                </p>
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
                  Creating account…
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="app-auth-footer">
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}