import {
  FetchSupabaseRestClient,
  SupabaseRestError,
  type SupabaseRestResponse,
} from '../supabase-rest-client.js';

function fixture(response: Response = Response.json([{ id: 'user-123' }])) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetcher: typeof fetch = (url, init) => {
    calls.push({
      url:
        url instanceof URL ? url.href : typeof url === 'string' ? url : url.url,
      init,
    });
    return Promise.resolve(response);
  };

  return {
    client: new FetchSupabaseRestClient('server-key', fetcher),
    calls,
  };
}

describe('FetchSupabaseRestClient', () => {
  it('sends the service-role credentials and returns JSON responses', async () => {
    const setup: ReturnType<typeof fixture> = fixture();

    await expect(
      setup.client.request(new URL('https://project.supabase.co/rest/v1/users')),
    ).resolves.toEqual([{ id: 'user-123' }]);

    const headers: Headers = new Headers(setup.calls[0]?.init?.headers);
    expect(setup.calls[0]?.url).toBe('https://project.supabase.co/rest/v1/users');
    expect(headers.get('apikey')).toBe('server-key');
    expect(headers.get('Authorization')).toBe('Bearer server-key');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('returns null for a no-content response', async () => {
    const setup: ReturnType<typeof fixture> = fixture(new Response(null, { status: 204 }));

    await expect(
      setup.client.request(new URL('https://project.supabase.co/rest/v1/users')),
    ).resolves.toBeNull();
  });

  it('exposes the status and database code for failed requests', async () => {
    const setup: ReturnType<typeof fixture> = fixture(
      Response.json({ code: '23505' }, { status: 409 }),
    );

    await expect(
      setup.client.request(new URL('https://project.supabase.co/rest/v1/users')),
    ).rejects.toMatchObject({
      status: 409,
      code: '23505',
      message: 'Supabase REST request failed with status 409.',
    });
  });

  it.each([
    { status: 500, body: ['database error'] },
    { status: 500, body: { code: 7 } },
    { status: 500, body: {} },
    { status: 500, body: null },
  ])(
    'returns a null error code when an error body has no string code',
    async ({
      status,
      body,
    }: { status: number; body: object | null }) => {
    const setup: ReturnType<typeof fixture> = fixture(Response.json(body, { status }));

    await expect(
      setup.client.request(new URL('https://project.supabase.co/rest/v1/users')),
    ).rejects.toMatchObject({ status, code: null });
    },
  );

  it('rejects a successful response that is not JSON object data', async () => {
    const setup: ReturnType<typeof fixture> = fixture(Response.json('not-an-object'));

    await expect(
      setup.client.request(new URL('https://project.supabase.co/rest/v1/users')),
    ).rejects.toMatchObject({
      status: 200,
      code: null,
      message: 'Supabase returned an invalid response.',
    });
  });

  it('rejects a successful empty JSON response', async () => {
    const setup: ReturnType<typeof fixture> = fixture(Response.json(null));

    await expect(
      setup.client.request(new URL('https://project.supabase.co/rest/v1/users')),
    ).rejects.toMatchObject({
      status: 200,
      code: null,
      message: 'Supabase returned an invalid response.',
    });
  });

  it('classifies fetch connection failures as Supabase unavailable', async () => {
    const client: FetchSupabaseRestClient = new FetchSupabaseRestClient(
      'server-key',
      () => Promise.reject(new TypeError('connection failed')),
    );

    const request: Promise<SupabaseRestResponse> = client.request(
      new URL('https://project.supabase.co/rest/v1/users'),
    );

    await expect(request).rejects.toBeInstanceOf(SupabaseRestError);
    await expect(request).rejects.toHaveProperty('status', 503);
    await expect(request).rejects.toHaveProperty('code', null);
    await expect(request).rejects.toHaveProperty(
      'message',
      'Supabase REST request could not be completed.',
    );
    await expect(request).rejects.toHaveProperty(
      'cause.message',
      'connection failed',
    );
  });

  it('propagates non-network errors from the fetch implementation', async () => {
    const client: FetchSupabaseRestClient = new FetchSupabaseRestClient(
      'server-key',
      () => Promise.reject(new Error('unexpected fetch failure')),
    );

    await expect(
      client.request(new URL('https://project.supabase.co/rest/v1/users')),
    ).rejects.toThrow('unexpected fetch failure');
  });
});
