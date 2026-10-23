import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const COMPANION_SCOPES = ["session:read", "observation:write"] as const;
export type CompanionScope = (typeof COMPANION_SCOPES)[number];
export type PairingState =
  | "awaiting_pairing"
  | "paired"
  | "expired"
  | "revoked"
  | "completed";

export interface PairingSession {
  session_id: string;
  tv_device_id: string;
  state: PairingState;
  created_at: string;
  pairing_code_expires_at: string;
  credential_expires_at: string;
  companion_device_id: string | null;
  anonymous: true;
}

export interface CreatedPairingSession {
  session: PairingSession;
  pairing_code: string;
}

export interface PairingCredential {
  credential: string;
  session_id: string;
  device_id: string;
  scopes: CompanionScope[];
  issued_at: string;
  expires_at: string;
  device_nonce_bound: true;
}

export interface CredentialClaims {
  session_id: string;
  device_id: string;
  scopes: CompanionScope[];
  expires_at: string;
}

export interface PairingResult {
  session: PairingSession;
  credential: PairingCredential;
}

interface StoredSession {
  public: PairingSession;
  code_hash: string;
  code_consumed: boolean;
  credential_hash: string | null;
  credential_expires_at_ms: number;
  device_nonce_hash: string | null;
}

export interface FixturePairingOptions {
  clock?: () => Date;
  codeGenerator?: () => string;
  idGenerator?: () => string;
  credentialGenerator?: () => string;
  maxFailedAttempts?: number;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function equalDigest(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function validInstant(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

/**
 * In-memory pairing fixture. It models token scope and lifecycle only; no REST,
 * WebSocket, Cognito, DynamoDB, or companion connection is created.
 */
export class FixturePairingService {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly codeIndex = new Map<string, string>();
  private readonly failedAttempts = new Map<string, number[]>();
  private readonly clock: () => Date;
  private readonly codeGenerator: () => string;
  private readonly idGenerator: () => string;
  private readonly credentialGenerator: () => string;
  private readonly maxFailedAttempts: number;

  constructor(options: FixturePairingOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.codeGenerator =
      options.codeGenerator ??
      (() =>
        Array.from(
          { length: 6 },
          () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
        ).join(""));
    this.idGenerator = options.idGenerator ?? (() => randomUUID());
    this.credentialGenerator =
      options.credentialGenerator ??
      (() => randomBytes(32).toString("base64url"));
    this.maxFailedAttempts = options.maxFailedAttempts ?? 5;
    if (
      !Number.isSafeInteger(this.maxFailedAttempts) ||
      this.maxFailedAttempts < 1
    ) {
      throw new Error("invalid_pairing_rate_limit");
    }
  }

  private now(): Date {
    const value = this.clock();
    if (!validInstant(value)) throw new Error("invalid_pairing_clock");
    return value;
  }

  private publicSession(stored: StoredSession): PairingSession {
    return clone(stored.public);
  }

  private requireSession(sessionId: string): StoredSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("pairing_session_not_found");
    return session;
  }

  private rateLimitKeys(deviceId: string, ipAddress: string): string[] {
    return [`device:${deviceId}`, `ip:${ipAddress}`];
  }

  private recentFailures(key: string, now: Date): number[] {
    const recent = (this.failedAttempts.get(key) ?? []).filter(
      (timestamp) => now.getTime() - timestamp < 5 * 60 * 1000,
    );
    this.failedAttempts.set(key, recent);
    return recent;
  }

  private checkRateLimit(deviceId: string, ipAddress: string, now: Date): void {
    if (
      this.rateLimitKeys(deviceId, ipAddress).some(
        (key) => this.recentFailures(key, now).length >= this.maxFailedAttempts,
      )
    ) {
      throw new Error("pairing_rate_limited");
    }
  }

  private recordFailure(deviceId: string, ipAddress: string, now: Date): void {
    for (const key of this.rateLimitKeys(deviceId, ipAddress)) {
      this.recentFailures(key, now).push(now.getTime());
    }
  }

  createSession(input: {
    tvDeviceId: string;
    parentApproved: boolean;
  }): CreatedPairingSession {
    if (!input.tvDeviceId.trim() || !input.parentApproved) {
      throw new Error("parent_approved_tv_session_required");
    }
    const now = this.now();
    const sessionId = this.idGenerator();
    const pairingCode = this.codeGenerator();
    if (
      !sessionId.trim() ||
      this.sessions.has(sessionId) ||
      !CODE_PATTERN.test(pairingCode)
    ) {
      throw new Error("invalid_fixture_pairing_material");
    }
    const codeHash = digest(pairingCode).toString("hex");
    if (this.codeIndex.has(codeHash)) throw new Error("duplicate_pairing_code");
    const createdAt = now.toISOString();
    const session: PairingSession = {
      session_id: sessionId,
      tv_device_id: input.tvDeviceId,
      state: "awaiting_pairing",
      created_at: createdAt,
      pairing_code_expires_at: new Date(
        now.getTime() + 5 * 60 * 1000,
      ).toISOString(),
      credential_expires_at: new Date(
        now.getTime() + 12 * 60 * 60 * 1000,
      ).toISOString(),
      companion_device_id: null,
      anonymous: true,
    };
    this.sessions.set(sessionId, {
      public: session,
      code_hash: codeHash,
      code_consumed: false,
      credential_hash: null,
      credential_expires_at_ms: now.getTime() + 12 * 60 * 60 * 1000,
      device_nonce_hash: null,
    });
    this.codeIndex.set(codeHash, sessionId);
    return {
      session: this.publicSession(this.requireSession(sessionId)),
      pairing_code: pairingCode,
    };
  }

  exchange(input: {
    code: string;
    deviceNonce: string;
    companionDeviceId: string;
    ipAddress: string;
  }): PairingResult {
    const now = this.now();
    if (
      !CODE_PATTERN.test(input.code) ||
      input.deviceNonce.trim().length < 16 ||
      input.deviceNonce.length > 128 ||
      !input.companionDeviceId.trim() ||
      !input.ipAddress.trim()
    ) {
      throw new Error("invalid_pairing_exchange");
    }
    this.checkRateLimit(input.companionDeviceId, input.ipAddress, now);
    const sessionId = this.codeIndex.get(digest(input.code).toString("hex"));
    const stored = sessionId ? this.sessions.get(sessionId) : undefined;
    if (!stored) {
      this.recordFailure(input.companionDeviceId, input.ipAddress, now);
      throw new Error("pairing_code_rejected");
    }
    if (
      stored.code_consumed ||
      stored.public.state === "revoked" ||
      stored.public.state === "completed"
    ) {
      this.recordFailure(input.companionDeviceId, input.ipAddress, now);
      throw new Error("pairing_code_consumed");
    }
    if (now.getTime() >= Date.parse(stored.public.pairing_code_expires_at)) {
      stored.public.state = "expired";
      this.recordFailure(input.companionDeviceId, input.ipAddress, now);
      throw new Error("pairing_code_expired");
    }
    if (stored.public.state !== "awaiting_pairing") {
      this.recordFailure(input.companionDeviceId, input.ipAddress, now);
      throw new Error("pairing_code_rejected");
    }
    const credential = this.credentialGenerator();
    if (!credential.trim() || credential === input.code) {
      throw new Error("invalid_scoped_credential");
    }
    const issuedAt = now.toISOString();
    const credentialExpiry = new Date(
      stored.credential_expires_at_ms,
    ).toISOString();
    const result: PairingCredential = {
      credential,
      session_id: stored.public.session_id,
      device_id: input.companionDeviceId,
      scopes: [...COMPANION_SCOPES],
      issued_at: issuedAt,
      expires_at: credentialExpiry,
      device_nonce_bound: true,
    };
    stored.code_consumed = true;
    stored.credential_hash = digest(credential).toString("hex");
    stored.device_nonce_hash = digest(input.deviceNonce).toString("hex");
    stored.public.state = "paired";
    stored.public.companion_device_id = input.companionDeviceId;
    for (const key of this.rateLimitKeys(
      input.companionDeviceId,
      input.ipAddress,
    )) {
      this.failedAttempts.delete(key);
    }
    return { session: this.publicSession(stored), credential: clone(result) };
  }

  authorize(input: {
    sessionId: string;
    deviceId: string;
    credential: string;
    requiredScope: CompanionScope;
  }): CredentialClaims {
    const stored = this.requireSession(input.sessionId);
    const now = this.now();
    if (now.getTime() >= stored.credential_expires_at_ms) {
      stored.public.state = "expired";
      stored.public.companion_device_id = null;
      stored.credential_hash = null;
      stored.device_nonce_hash = null;
      throw new Error("scoped_credential_rejected");
    }
    if (
      stored.public.state !== "paired" ||
      stored.public.companion_device_id !== input.deviceId ||
      !stored.credential_hash ||
      !stored.device_nonce_hash ||
      !equalDigest(
        digest(input.credential),
        Buffer.from(stored.credential_hash, "hex"),
      )
    ) {
      throw new Error("scoped_credential_rejected");
    }
    if (
      !input.requiredScope ||
      !COMPANION_SCOPES.includes(input.requiredScope)
    ) {
      throw new Error("pairing_scope_rejected");
    }
    return {
      session_id: stored.public.session_id,
      device_id: input.deviceId,
      scopes: [...COMPANION_SCOPES],
      expires_at: new Date(stored.credential_expires_at_ms).toISOString(),
    };
  }

  revoke(input: {
    sessionId: string;
    actorRole: "adult";
    adultConfirmed: boolean;
  }): PairingSession {
    if (input.actorRole !== "adult" || !input.adultConfirmed) {
      throw new Error("adult_revocation_required");
    }
    const stored = this.requireSession(input.sessionId);
    stored.public.state = "revoked";
    stored.public.companion_device_id = null;
    stored.code_consumed = true;
    stored.credential_hash = null;
    stored.device_nonce_hash = null;
    return this.publicSession(stored);
  }

  complete(input: { sessionId: string; tvDeviceId: string }): PairingSession {
    const stored = this.requireSession(input.sessionId);
    if (stored.public.tv_device_id !== input.tvDeviceId) {
      throw new Error("tv_session_binding_mismatch");
    }
    stored.public.state = "completed";
    stored.public.companion_device_id = null;
    stored.code_consumed = true;
    stored.credential_hash = null;
    stored.device_nonce_hash = null;
    return this.publicSession(stored);
  }

  getSession(sessionId: string): PairingSession {
    return this.publicSession(this.requireSession(sessionId));
  }

  get credentialCount(): number {
    return [...this.sessions.values()].filter(
      (session) => session.credential_hash !== null,
    ).length;
  }
}
