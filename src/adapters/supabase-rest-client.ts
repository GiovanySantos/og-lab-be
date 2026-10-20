export type SupabaseRestResponse = object | object[] | null;

export interface SupabaseRestClient {
  request(url: URL, init?: RequestInit): Promise<SupabaseRestResponse>;
}

export class SupabaseRestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class FetchSupabaseRestClient implements SupabaseRestClient {
  public constructor(
    private readonly serviceRoleKey: string,
    private readonly fetcher: SupabaseFetch = fetch,
  ) {}

  public async request(
    url: URL,
    init: RequestInit = {},
  ): Promise<SupabaseRestResponse> {
    const headers = new Headers(init.headers);
    headers.set('apikey', this.serviceRoleKey);
    headers.set('Authorization', `Bearer ${this.serviceRoleKey}`);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    let response: SupabaseHttpResponse;

    try {
      response = await this.fetcher(url, { ...init, headers });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new SupabaseRestError(
          503,
          null,
          'Supabase REST request could not be completed.',
          { cause: error },
        );
      }

      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    const payload = await response.json();

    if (!response.ok) {
      throw new SupabaseRestError(
        response.status,
        errorCode(payload),
        `Supabase REST request failed with status ${String(response.status)}.`,
      );
    }

    if (payload === null || typeof payload !== 'object') {
      throw new SupabaseRestError(
        response.status,
        null,
        'Supabase returned an invalid response.',
      );
    }

    return payload;
  }
}

type JsonPayload = object | object[] | string | number | boolean | null;
type SupabaseHttpResponse = {
  status: number;
  ok: boolean;
  json(): Promise<JsonPayload>;
};
type SupabaseFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<SupabaseHttpResponse>;

function errorCode(payload: JsonPayload): string | null {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'code' in payload &&
    typeof payload.code === 'string'
  ) {
    return payload.code;
  }

  return null;
}
