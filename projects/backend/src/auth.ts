/**
 * JWT auth helpers for the backend.
 * Uses HMAC-SHA256 via the Web Crypto API (available in Bun and Node 20+).
 */

const JWT_SECRET =
  process.env.JWT_SECRET ?? "avocado-dev-secret-change-in-prod";
const ACCESS_TOKEN_TTL_S = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL_S = 7 * 24 * 60 * 60; // 7 days

// ─── HMAC-SHA256 JWT (HS256) — minimal, no external dep ─────────────────────

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type JwtPayload = {
  sub: string; // user id
  orgId: string;
  role: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
};

export async function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp">,
  ttlSeconds: number = ACCESS_TOKEN_TTL_S,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };

  const enc = new TextEncoder();
  const header = base64url(
    enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const body = base64url(enc.encode(JSON.stringify(full)));
  const sigInput = `${header}.${body}`;

  const key = await hmacKey(JWT_SECRET);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(sigInput));

  return `${sigInput}.${base64url(sig)}`;
}

export async function signRefreshJwt(
  payload: Omit<JwtPayload, "iat" | "exp" | "type">,
): Promise<string> {
  return signJwt({ ...payload, type: "refresh" }, REFRESH_TOKEN_TTL_S);
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid token");

  const [header, body, sig] = parts;
  const enc = new TextEncoder();
  const key = await hmacKey(JWT_SECRET);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(sig),
    enc.encode(`${header}.${body}`),
  );
  if (!valid) throw new Error("invalid signature");

  const payload: JwtPayload = JSON.parse(
    new TextDecoder().decode(base64urlDecode(body)),
  );

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("token expired");
  }
  return payload;
}

/**
 * Extract Bearer token from Authorization header.
 * Returns null if not present or malformed.
 */
export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

// ─── TURN credential issuance ─────────────────────────────────────────────────
// Uses HMAC-SHA1 per coturn's time-limited credential mechanism.

const COTURN_SECRET =
  process.env.COTURN_SECRET ?? "avocado-coturn-secret-change-in-prod";
const COTURN_HOST = process.env.COTURN_HOST ?? "localhost";
const COTURN_PORT = process.env.COTURN_PORT ?? "3478";
const TURN_TTL_S = 3600; // 1 hour

export async function issueTurnCredentials(sessionId: string): Promise<{
  username: string;
  credential: string;
  urls: string[];
}> {
  const expiry = Math.floor(Date.now() / 1000) + TURN_TTL_S;
  const username = `${expiry}:${sessionId}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(COTURN_SECRET),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(username));
  const credential = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  return {
    username,
    credential,
    urls: [
      `turn:${COTURN_HOST}:${COTURN_PORT}?transport=udp`,
      `turn:${COTURN_HOST}:${COTURN_PORT}?transport=tcp`,
    ],
  };
}
