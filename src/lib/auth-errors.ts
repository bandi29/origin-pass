/**
 * User-facing auth error messages (never leak raw Supabase internals).
 */
export function toFriendlyAuthError(raw: string): string {
  const text = raw.toLowerCase()
  if (text.includes("invalid login credentials")) {
    return "Incorrect email or password. Please try again."
  }
  if (text.includes("email not confirmed")) {
    return "Please verify your email before signing in."
  }
  if (text.includes("already registered") || text.includes("user already registered")) {
    return "This email is already registered. Try signing in instead."
  }
  if (text.includes("password should be") || text.includes("password is too short")) {
    return "Password is too weak. Use at least 6 characters."
  }
  if (text.includes("network") || text.includes("fetch")) {
    return "Network issue detected. Check your connection and try again."
  }
  if (text.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again."
  }
  if (text.includes("invalid email")) {
    return "Please enter a valid email address."
  }
  return "We could not complete that request. Please try again."
}
