declare interface AuthPayload {
  iss: string; // fingerprint
  jti: ReturnType<typeof crypto.randomUUID>;
}

declare interface RegisterPayload {
  iss: string; // fingerprint
  iat: number;
}
