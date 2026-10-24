import { readBoundedJson } from "./http-json.js";
export interface PairingCredential {
  session_id: string;
  device_id: string;
  credential: string;
  expires_at: string;
}
/** Application relay credentials only. Call after adult approval; never persist or log result. */
export class PairingClient {
  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly now = () => Date.now(),
  ) {}
  async exchange(
    code: string,
    deviceNonce: string,
  ): Promise<PairingCredential> {
    if (
      !/^[A-HJ-NP-Z2-9]{6}$/.test(code) ||
      !/^[a-zA-Z0-9_-]{16,80}$/.test(deviceNonce)
    )
      throw new Error("invalid_pairing_input");
    const response = await this.request("/v1/pairings/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, device_nonce: deviceNonce }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 401 || response.status === 410
          ? "pairing_expired_or_denied"
          : response.status === 429
            ? "pairing_rate_limited"
            : "pairing_unavailable",
      );
    const value = (await readBoundedJson(response)) as PairingCredential;
    if (
      !value ||
      Object.keys(value).sort().join() !==
        "credential,device_id,expires_at,session_id" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(value.session_id) ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(value.device_id) ||
      typeof value.credential !== "string" ||
      value.credential.length < 16 ||
      value.credential.length > 512 ||
      !Number.isFinite(Date.parse(value.expires_at)) ||
      Date.parse(value.expires_at) <= this.now() ||
      Date.parse(value.expires_at) > this.now() + 12 * 60 * 60 * 1000
    )
      throw new Error("invalid_pairing_response");
    return value;
  }
}
