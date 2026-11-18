import * as SDK from "@fonoster/sdk";
import type { FonosterConfig, VoiceCallRecord, VoiceCallRecordsClient } from "@qcobro/common";

type FonosterSettings = NonNullable<FonosterConfig>;

/** The subset of `SDK.CallRecords` QCobro uses — the seam tests inject a fake through. */
export type CallRecordsApi = Pick<SDK.CallRecords, "getRecord" | "getRecording">;

export type CreateCallRecordsApi = (settings: FonosterSettings) => Promise<CallRecordsApi>;

/** Logs in with the workspace API key and hands back a `CallRecords` client. */
async function loginAndCreateCallRecordsApi(settings: FonosterSettings): Promise<CallRecordsApi> {
  const client = new SDK.Client({
    accessKeyId: settings.accessKeyId,
    ...(settings.endpoint ? { endpoint: settings.endpoint } : {})
  } as ConstructorParameters<typeof SDK.Client>[0]);
  await client.loginWithApiKey(settings.apiKey, settings.apiSecret);
  return new SDK.CallRecords(client);
}

/**
 * Fonoster call records through the SDK's `CallRecords` (the HTTP records API), with the same
 * workspace credentials as the outbound call client. Always reads the redacted copy: neither
 * method ever passes `original`. The login is memoized once it succeeds and retried on the
 * next call after a failure; `CallRecords` refreshes an expired access token by itself.
 */
export class FonosterCallRecordsClient implements VoiceCallRecordsClient {
  private recordsPromise: Promise<CallRecordsApi> | null = null;

  constructor(
    private readonly settings: FonosterSettings,
    private readonly createApi: CreateCallRecordsApi = loginAndCreateCallRecordsApi
  ) {}

  private records(): Promise<CallRecordsApi> {
    if (!this.recordsPromise) {
      this.recordsPromise = this.createApi(this.settings).catch((err) => {
        this.recordsPromise = null;
        throw err;
      });
    }
    return this.recordsPromise;
  }

  async getRecord(callRef: string): Promise<VoiceCallRecord> {
    const records = await this.records();
    return (await records.getRecord(callRef)) as unknown as VoiceCallRecord;
  }

  async getRecording(callRef: string): Promise<{ data: ArrayBuffer; contentType: string }> {
    const records = await this.records();
    const { data, contentType } = await records.getRecording(callRef);
    return { data, contentType };
  }
}
