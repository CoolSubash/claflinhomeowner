export const REFRESH_TOKEN_COOKIE = "refresh_token";

// Keep in sync with the backend's REFRESH_TOKEN_EXPIRE_DAYS (default 30).
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const refreshCookieOptions = {
  httpOnly: true,
  // Browsers treat localhost as a secure context even over http, so this
  // only matters once the app is deployed to a real, non-localhost origin.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
