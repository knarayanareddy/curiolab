import { describe, expect, it } from "vitest";
import {
  FixturePairingService,
  type PairingCredential,
} from "../../services/pairing/src/fixture-pairing-service.js";

const START = new Date("2026-10-23T12:00:00.000Z");
const NONCE = "fixture-device-nonce-0001";

function fixture() {
  let now = START;
  const service = new FixturePairingService({
    clock: () => now,
    codeGenerator: () => "ABCD23",
    idGenerator: () => "fixture-session-pairing",
    credentialGenerator: () => "fixture-scoped-credential",
  });
  const created = service.createSession({
    tvDeviceId: "fixture-tv",
    parentApproved: true,
  });
  return {
    service,
    created,
    exchange: () =>
      service.exchange({
        code: created.pairing_code,
        deviceNonce: NONCE,
        companionDeviceId: "fixture-companion",
        ipAddress: "fixture-ip",
      }),
    advance: (value: Date) => {
      now = value;
    },
  };
}

function authorize(
  service: FixturePairingService,
  credential: PairingCredential,
  overrides: Partial<Parameters<FixturePairingService["authorize"]>[0]> = {},
) {
  return service.authorize({
    sessionId: credential.session_id,
    deviceId: credential.device_id,
    credential: credential.credential,
    requiredScope: "session:read",
    ...overrides,
  });
}

describe("CurioLab one-time scoped pairing fixture", () => {
  it("creates an anonymous five-minute code and exchanges it for a distinct scoped credential", () => {
    const { service, created, exchange } = fixture();
    expect(created.pairing_code).toBe("ABCD23");
    expect(created.pairing_code).not.toMatch(/[01OI]/);
    expect(created.session).toMatchObject({
      state: "awaiting_pairing",
      anonymous: true,
      pairing_code_expires_at: "2026-10-23T12:05:00.000Z",
      credential_expires_at: "2026-10-24T00:00:00.000Z",
    });
    const paired = exchange();
    expect(paired.session.state).toBe("paired");
    expect(paired.credential.credential).not.toBe(created.pairing_code);
    expect(paired.credential.scopes).toEqual([
      "session:read",
      "observation:write",
    ]);
    expect(paired.credential.scopes).not.toContain("measurement:commit");
    expect(paired.credential.device_nonce_bound).toBe(true);
    expect(service.credentialCount).toBe(1);
    expect(service.getSession(created.session.session_id)).not.toHaveProperty(
      "credential",
    );
  });

  it("denies expired codes and a second use without issuing another credential", () => {
    const expired = fixture();
    expired.advance(new Date("2026-10-23T12:05:00.000Z"));
    expect(() => expired.exchange()).toThrow("pairing_code_expired");
    expect(expired.service.credentialCount).toBe(0);

    const consumed = fixture();
    consumed.exchange();
    expect(() =>
      consumed.service.exchange({
        code: consumed.created.pairing_code,
        deviceNonce: "another-device-nonce-0001",
        companionDeviceId: "second-companion",
        ipAddress: "another-ip",
      }),
    ).toThrow("pairing_code_consumed");
    expect(consumed.service.credentialCount).toBe(1);
  });

  it("binds authorization to session, device, token, and allowed scope", () => {
    const { service, exchange } = fixture();
    const paired = exchange();
    expect(authorize(service, paired.credential)).toMatchObject({
      session_id: paired.session.session_id,
      device_id: "fixture-companion",
      scopes: ["session:read", "observation:write"],
    });
    expect(() =>
      authorize(service, paired.credential, { deviceId: "other-device" }),
    ).toThrow("scoped_credential_rejected");
    expect(() =>
      authorize(service, paired.credential, { credential: "forged" }),
    ).toThrow("scoped_credential_rejected");
    expect(() =>
      authorize(service, paired.credential, {
        requiredScope: "session:delete" as never,
      }),
    ).toThrow("pairing_scope_rejected");
    expect(() =>
      service.exchange({
        code: "ABCD23",
        deviceNonce: "short",
        companionDeviceId: "fixture-companion",
        ipAddress: "fixture-ip",
      }),
    ).toThrow("invalid_pairing_exchange");
  });

  it("revokes on adult action and completion, and expires credentials after twelve hours", () => {
    const revoked = fixture();
    const revokedPair = revoked.exchange();
    revoked.service.revoke({
      sessionId: revokedPair.session.session_id,
      actorRole: "adult",
      adultConfirmed: true,
    });
    expect(
      revoked.service.getSession(revokedPair.session.session_id).state,
    ).toBe("revoked");
    expect(revoked.service.credentialCount).toBe(0);
    expect(() => authorize(revoked.service, revokedPair.credential)).toThrow(
      "scoped_credential_rejected",
    );

    const completed = fixture();
    const completedPair = completed.exchange();
    completed.service.complete({
      sessionId: completedPair.session.session_id,
      tvDeviceId: "fixture-tv",
    });
    expect(completed.service.credentialCount).toBe(0);
    expect(() =>
      authorize(completed.service, completedPair.credential),
    ).toThrow("scoped_credential_rejected");

    const expiring = fixture();
    const expiringPair = expiring.exchange();
    expiring.advance(new Date("2026-10-24T00:00:00.000Z"));
    expect(() => authorize(expiring.service, expiringPair.credential)).toThrow(
      "scoped_credential_rejected",
    );
    expect(expiring.service.credentialCount).toBe(0);
  });

  it("rate-limits repeated failed exchanges and requires adult revocation", () => {
    const { service, created } = fixture();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(() =>
        service.exchange({
          code: "ZZZZ99",
          deviceNonce: NONCE,
          companionDeviceId: "fixture-companion",
          ipAddress: "fixture-ip",
        }),
      ).toThrow("pairing_code_rejected");
    }
    expect(() =>
      service.exchange({
        code: created.pairing_code,
        deviceNonce: NONCE,
        companionDeviceId: "fixture-companion",
        ipAddress: "fixture-ip",
      }),
    ).toThrow("pairing_rate_limited");
    expect(() =>
      service.exchange({
        code: created.pairing_code,
        deviceNonce: NONCE,
        companionDeviceId: "fixture-companion",
        ipAddress: "rotated-ip",
      }),
    ).toThrow("pairing_rate_limited");
    expect(() =>
      service.exchange({
        code: created.pairing_code,
        deviceNonce: NONCE,
        companionDeviceId: "rotated-device",
        ipAddress: "fixture-ip",
      }),
    ).toThrow("pairing_rate_limited");
    expect(() =>
      service.revoke({
        sessionId: created.session.session_id,
        actorRole: "adult",
        adultConfirmed: false,
      }),
    ).toThrow("adult_revocation_required");
    expect(service.credentialCount).toBe(0);
  });
});
