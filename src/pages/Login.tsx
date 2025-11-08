import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import house from '@/assets/home-2.avif'
import "../styles/login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signInWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // redirect user to previous path or dashboard after login
  const from = (location.state as any)?.from?.pathname || "/dashboard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setSubmitting(true);
      await signInWithEmail(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Failed to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleLogin() {
    setError(null);
    try {
      setSubmitting(true);
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      {/* LEFT: Form */}
      <section className="auth-left">
        <div className="brand">HomeReady</div>
        <h1 className="title">Welcome back</h1>
        <p className="subtitle">
          Don’t have an account?{" "}
          <Link className="link" to="/signup">
            Sign up
          </Link>
        </p>

        <form className="card" onSubmit={onSubmit} aria-label="Sign in form">
          <div className="field">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="row between">
            <label className="remember">
              <input type="checkbox" /> Remember me
            </label>
            <a
              className="muted"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert("Password reset feature coming soon!");
              }}
            >
              Forgot password?
            </a>
          </div>

          {error && <p className="error">{error}</p>}

          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In"}
          </button>

          <div className="or">or</div>

          <button
            type="button"
            className="btn google"
            onClick={onGoogleLogin}
            disabled={submitting}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
            >
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.6C16.8 3.3 14.6 2.4 12 2.4 6.9 2.4 2.7 6.6 2.7 11.7S6.9 21 12 21c6.9 0 9.3-4.8 9.3-7.2 0-.5-.1-.8-.1-1.1H12Z"
              />
              <path
                fill="#4285F4"
                d="M21.3 12c0-.6-.1-1.1-.1-1.5H12v3h5.3c-.1.7-.6 1.8-1.7 2.6l2.6 2c1.6-1.5 2.5-3.6 2.5-6.1Z"
              />
              <path
                fill="#FBBC05"
                d="M6.6 14.4a5 5 0 0 1-.3-1.6c0-.5.1-1 .3-1.6l-2.5-2A8.8 8.8 0 0 0 3 12.8c0 1.4.3 2.8 1.1 4l2.5-2.4Z"
              />
              <path
                fill="#34A853"
                d="M12 21c2.4 0 4.4-.8 5.9-2.2l-2.6-2c-.7.5-1.7.9-3.3.9-2.5 0-4.6-1.7-5.4-4.1l-2.6 2c1 3 4 5.4 8 5.4Z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </form>
      </section>

      {/* RIGHT: Hero */}
      <aside className="auth-right"  style={{ ["--hero" as any]: `url(${house})` }}>
        <div className="hero-overlay">
        <h2>Your Path to Home Ownership</h2>
    <p>Discover tools, insights, and support to prepare for your first home.</p>
        </div>
      </aside>
    </div>
  );
}
