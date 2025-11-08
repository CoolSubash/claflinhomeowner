// src/pages/Signup.tsx
import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "@/styles/signup.css";
import house from '@/assets/house.avif'
import { useAuth } from "@/context/AuthContext";

type Address = {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  lat: number | null;
  lng: number | null;
};

export default function Signup() {
  const navigate = useNavigate();
  const { signUpWithEmail, signInWithGoogle } = useAuth();

  // form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string>("");
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [phoneError, setPhoneError] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // address
  const [address, setAddress] = useState<Address>({
    line1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    lat: null,
    lng: null,
  });

  const addressInputRef = useRef<HTMLInputElement | null>(null); // reserved for future autocomplete

  const canSubmit =
    !!name &&
    !!email &&
    (!phone || isValidPhoneNumber(phone)) &&
    password.length >= 6 &&
    password === confirm &&
    !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (phone && !isValidPhoneNumber(phone)) {
      setPhoneError("Please enter a valid phone number.");
      return;
    }
    setPhoneError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);

      // Pass extra profile data to the context; it will save to Firestore
      await signUpWithEmail(email, password, {
        name,
        phone,
        gender,
        address,
      });

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleSignup() {
    setError(null);
    try {
      setSubmitting(true);
      await signInWithGoogle({
        // Optional extras to merge on first login
        phone,
        gender,
        address,
      });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* If you show the global nav on auth pages, keep this. Otherwise, remove. */}
      {/* <Navbar /> */}

      <div className="auth-shell">
        {/* IMAGE SIDE */}
        <aside
      className="auth-right"
      style={{ ["--hero" as any]: `url(${house})` }}
      aria-hidden="true"
    />

        {/* FORM SIDE */}
        <section className="auth-left">
          <div className="brand">HomeReady</div>
          <h1 className="title">Let’s get started</h1>
          <p className="subtitle">
            Already have an account?{" "}
            <Link className="link" to="/login">Log in</Link>
          </p>

          <form className="card" onSubmit={onSubmit} noValidate>
            {/* Full name */}
            <div className="field">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                className="input"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div className="field">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Phone with country code */}
            <div className="field">
              <label htmlFor="phone">Phone Number</label>
              <PhoneInput
                id="phone"
                international
                defaultCountry="US"
                placeholder="Enter phone number"
                value={phone}
                onChange={(v) => setPhone(v || "")}
                className="phone-input"
              />
              {phoneError && <div className="error">{phoneError}</div>}
            </div>

            {/* Address */}
            <div className="grid-2">
              <div className="field">
                <label htmlFor="line1">Street</label>
                <input
                  id="line1"
                  ref={addressInputRef}
                  className="input"
                  placeholder="Street address"
                  value={address.line1}
                  onChange={(e) =>
                    setAddress((a) => ({ ...a, line1: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="city">City</label>
                <input
                  id="city"
                  className="input"
                  placeholder="City"
                  value={address.city}
                  onChange={(e) =>
                    setAddress((a) => ({ ...a, city: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="state">State</label>
                <input
                  id="state"
                  className="input"
                  placeholder="State"
                  value={address.state}
                  onChange={(e) =>
                    setAddress((a) => ({ ...a, state: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="zip">ZIP Code</label>
                <input
                  id="zip"
                  className="input"
                  placeholder="ZIP"
                  value={address.postalCode}
                  onChange={(e) =>
                    setAddress((a) => ({ ...a, postalCode: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Gender */}
            <div className="field">
              <label>Gender</label>
              <div className="radio-row">
                {["Male", "Female", "Other", "Prefer_not_to_say"].map((g) => (
                  <label key={g} className="radio">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={gender === g}
                      onChange={(e) => setGender(e.target.value)}
                    />
                    <span>{g.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Passwords */}
            <div className="grid-2">
              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  className="input"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Error */}
            {error && <p className="error">{error}</p>}

            {/* Submit */}
            <button className="btn primary" type="submit" disabled={!canSubmit}>
              {submitting ? "Creating..." : "Sign Up"}
            </button>

            <div className="or">or</div>

            {/* Google */}
            <button
              type="button"
              className="btn google"
              onClick={onGoogleSignup}
              disabled={submitting}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.6C16.8 3.3 14.6 2.4 12 2.4 6.9 2.4 2.7 6.6 2.7 11.7S6.9 21 12 21c6.9 0 9.3-4.8 9.3-7.2 0-.5-.1-.8-.1-1.1H12Z"/>
                <path fill="#4285F4" d="M21.3 12c0-.6-.1-1.1-.1-1.5H12v3h5.3c-.1.7-.6 1.8-1.7 2.6l2.6 2c1.6-1.5 2.5-3.6 2.5-6.1Z"/>
                <path fill="#FBBC05" d="M6.6 14.4a5 5 0 0 1-.3-1.6c0-.5.1-1 .3-1.6l-2.5-2A8.8 8.8 0 0 0 3 12.8c0 1.4.3 2.8 1.1 4l2.5-2.4Z"/>
                <path fill="#34A853" d="M12 21c2.4 0 4.4-.8 5.9-2.2l-2.6-2c-.7.5-1.7.9-3.3.9-2.5 0-4.6-1.7-5.4-4.1l-2.6 2c1 3 4 5.4 8 5.4Z"/>
              </svg>
              <span>Sign up with Google</span>
            </button>

            <p className="legal">
              By continuing, you agree to our <a href="#">Terms</a> and <a href="#">Privacy</a>.
            </p>
          </form>
        </section>
      </div>

      {/* <Footer /> */}
    </>
  );
}
