type QueryResult<T = any> = Promise<{ data: T; error: null }>;

function resolved<T>(data: T): QueryResult<T> {
  return Promise.resolve({ data, error: null });
}

function createQueryBuilder() {
  const builder: any = {
    data: null,
    error: null,
    count: 0,
    select(..._args: any[]) {
      return builder;
    },
    insert(..._args: any[]) {
      return builder;
    },
    update(..._args: any[]) {
      return builder;
    },
    upsert(..._args: any[]) {
      return builder;
    },
    delete(..._args: any[]) {
      return builder;
    },
    eq(..._args: any[]) {
      return builder;
    },
    neq(..._args: any[]) {
      return builder;
    },
    gt(..._args: any[]) {
      return builder;
    },
    gte(..._args: any[]) {
      return builder;
    },
    lt(..._args: any[]) {
      return builder;
    },
    lte(..._args: any[]) {
      return builder;
    },
    in(..._args: any[]) {
      return builder;
    },
    order(..._args: any[]) {
      return builder;
    },
    limit(..._args: any[]) {
      return builder;
    },
    match(..._args: any[]) {
      return builder;
    },
    or(..._args: any[]) {
      return builder;
    },
    not(..._args: any[]) {
      return builder;
    },
    rpc(..._args: any[]) {
      return builder;
    },
    single() {
      return Promise.resolve({ data: builder.data, error: null });
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve: (value: { data: any[]; error: null }) => unknown) {
      return Promise.resolve({
        data: builder.data ?? [],
        error: null,
        count: 0,
      }).then(resolve);
    },
  };

  return builder;
}

function createChannel() {
  const channel: any = {
    on(..._args: any[]) {
      return channel;
    },
    async subscribe() {
      return channel;
    },
    async send() {
      return 'ok';
    },
    async track() {
      return 'ok';
    },
    presenceState() {
      return {};
    },
    unsubscribe() {
      return Promise.resolve('ok');
    },
  };

  return channel;
}

export type AuthChangeEvent = string;
export type Session = {
  user?: {
    id: string;
    email?: string;
  } | null;
  access_token?: string;
  refresh_token?: string;
};
export type RealtimeChannel = ReturnType<typeof createChannel>;
export type RealtimePostgresChangesPayload<T> = {
  eventType?: string;
  schema?: string;
  table?: string;
  new?: T;
  old?: T;
};
export type SupabaseClient = ReturnType<typeof createClient>;

export function createClient<T = any>(..._args: any[]) {
  return {
    auth: {
      async signUp(..._args: any[]) {
        return {
          data: { user: { id: '', email: '' }, session: null },
          error: null,
        } as any;
      },
      async signInWithPassword(..._args: any[]) {
        return {
          data: { user: { id: '', email: '' }, session: null },
          error: null,
        } as any;
      },
      async signOut(..._args: any[]) {
        return { error: null };
      },
      async getSession(..._args: any[]) {
        return { data: { session: null }, error: null };
      },
      async getUser(..._args: any[]) {
        return { data: { user: { id: '', email: '' } }, error: null } as any;
      },
      async resetPasswordForEmail(..._args: any[]) {
        return { error: null };
      },
      async updateUser(..._args: any[]) {
        return { error: null };
      },
      onAuthStateChange(
        callback: (event: AuthChangeEvent, session: Session | null) => void
      ) {
        callback('SIGNED_OUT', null);
        return {
          data: {
            subscription: {
              unsubscribe() {
                return undefined;
              },
            },
          },
        };
      },
      admin: {
        async deleteUser() {
          return { error: null };
        },
      },
    },
    from(..._args: any[]) {
      return createQueryBuilder();
    },
    channel(..._args: any[]) {
      return createChannel();
    },
    removeChannel(..._args: any[]) {
      return Promise.resolve('ok');
    },
    rpc(..._args: any[]) {
      return createQueryBuilder();
    },
    storage: {
      async listBuckets() {
        return { data: [], error: null };
      },
      async createBucket(..._args: any[]) {
        return { data: null, error: null };
      },
      from(..._args: any[]) {
        return {
          async upload(..._uploadArgs: any[]) {
            return { data: null, error: null };
          },
          async remove(..._removeArgs: any[]) {
            return { data: null, error: null };
          },
          async list(..._listArgs: any[]) {
            return { data: [], error: null };
          },
          async download(..._downloadArgs: any[]) {
            return { data: new Blob(), error: null };
          },
          async createSignedUrls(paths: string[], ..._args: any[]) {
            return {
              data: paths.map(path => ({ path, signedUrl: path })),
              error: null,
            };
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl: path,
              },
            };
          },
        };
      },
    },
  };
}
