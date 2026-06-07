import jwt from "jsonwebtoken";

// Verify a Bearer JWT and attach { id, email } to req.user.
export function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthenticated" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

// Wrap an async handler so rejected promises reach Express's error handler.
export const ah = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
