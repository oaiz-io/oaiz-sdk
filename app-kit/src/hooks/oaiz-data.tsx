import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  QueryClient,
  hashKey,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import type { OaizClient, OaizError, OaizFilters } from '@oaiz/sdk';


type OaizData = {
  client: OaizClient;
  /** The id of the database `client` reads; query keys carry it, so two databases never share a cache entry. */
  database: string;
  /** The signed-in member's id; query keys carry it, because row policies give each member their own rows. */
  member: string;
};

const OaizDataContext = createContext<OaizData | null>(null);

/** Gives the row hooks the client and database they use. Place it inside `QueryClientProvider`. */
export function OaizDataProvider({
  client,
  database,
  member,
  children,
}: OaizData & { children: ReactNode }) {
  return (
    <OaizDataContext.Provider value={{ client, database, member }}>
      {children}
    </OaizDataContext.Provider>
  );
}

function useOaizData(): OaizData {
  const data = useContext(OaizDataContext);
  if (data === null) {
    throw new Error('The OAIZ row hooks need an OaizDataProvider above them.');
  }
  return data;
}

/** A request OAIZ refused or that got no answer; `status` is 0 when no answer arrived. */
export class OaizRequestError extends Error {
  readonly code: string;
  readonly hints: string[];
  readonly status: number;

  constructor(error: OaizError, status: number) {
    super(error.message);
    this.name = 'OaizRequestError';
    this.code = error.code;
    this.hints = error.hints;
    this.status = status;
  }
}

/**
 * The query client of an app: rows stay fresh for 30 seconds, so moving between screens reads no
 * row twice, and a failed read is tried once more unless OAIZ refused it.
 */
export function newOaizQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failures, error) => {
          const refused =
            error instanceof OaizRequestError && error.status >= 400 && error.status < 500;
          return failures < 1 && !refused;
        },
      },
    },
  });
}

/** The key prefix of every query of one table: its row lists, pages and single rows. */
export const tableKey = (member: string, database: string, table: string) =>
  ['oaiz', member, database, table] as const;

/** The key prefix of every row list of one table. */
export const rowsKey = (member: string, database: string, table: string) =>
  [...tableKey(member, database, table), 'rows'] as const;

/** The key prefix of every page of one table. */
export const pageKey = (member: string, database: string, table: string) =>
  [...tableKey(member, database, table), 'page'] as const;

/** The key of one row of one table. */
export const rowKey = (member: string, database: string, table: string, id: RowId) =>
  [...tableKey(member, database, table), 'row', id] as const;

export type RowId = string | number;

/** One condition on one column; the query sends it, so OAIZ filters before it pages. */
export type RowFilter =
  | {
      column: string;
      op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
      value: string | number | boolean;
    }
  | { column: string; op: 'ilike'; value: string }
  | { column: string; op: 'in'; value: readonly (string | number)[] }
  | { column: string; op: 'is'; value: null | boolean }
  /** Matches when any member does, from a string such as `a.eq.1,b.ilike."%x%"`. */
  | { op: 'or'; value: string };

export type RowsOptions = {
  /** The columns to read, as in `select`; all columns when omitted. */
  columns?: string;
  filters?: RowFilter[];
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  /**
   * Keeps the rows on screen while a changed filter loads. Set it on a search or filter the member
   * types in. Without it, rows show only for their own filters, so one record's screen never shows
   * another record's rows.
   */
  keepRows?: boolean;
};

export type PageOptions = Omit<RowsOptions, 'limit'> & {
  /** The page to read, from 0. */
  page: number;
  pageSize: number;
};

/** One page of rows and the number of rows that match the filters. */
export type RowPage<Row> = { rows: Row[]; count: number };

type Filterable = OaizFilters<Record<string, unknown>>;

function applyFilters<Builder extends Filterable>(
  request: Builder,
  filters: RowFilter[] = [],
): Builder {
  let filtered = request;
  for (const filter of filters) {
    switch (filter.op) {
      case 'or':
        filtered = filtered.or(filter.value);
        break;
      case 'ilike':
        filtered = filtered.ilike(filter.column, filter.value);
        break;
      case 'in':
        filtered = filtered.in(filter.column, filter.value);
        break;
      case 'is':
        filtered = filtered.is(filter.column, filter.value);
        break;
      default:
        filtered = filtered[filter.op](filter.column, filter.value);
    }
  }
  return filtered;
}

/**
 * Keeps the previous rows through a new page or order of the same table and columns; a new filter
 * keeps them only on `keepRows`.
 */
function keepRowsFor<Data>(queryKey: QueryKey, keepRows = false) {
  const read = (key: QueryKey) => {
    const { columns, filters } = key[key.length - 1] as Pick<RowsOptions, 'columns' | 'filters'>;
    return hashKey([...key.slice(0, -1), columns, keepRows ? [] : (filters ?? [])]);
  };
  return (previous: Data | undefined, query?: { queryKey: QueryKey }) =>
    query && read(query.queryKey) === read(queryKey) ? previous : undefined;
}

/**
 * The rows of one table, or its totals when `columns` names aggregates, as in
 * `stage, total:amount.sum(), count()`. The previous rows stay on screen through a new order, and
 * through a new filter on `keepRows`. A refused read rejects with `OaizRequestError`.
 */
export function useRows<Row>(table: string, { keepRows, ...options }: RowsOptions = {}) {
  const { client, database, member } = useOaizData();
  const queryKey = [...rowsKey(member, database, table), options];
  return useQuery({
    queryKey,
    placeholderData: keepRowsFor<Row[]>(queryKey, keepRows),
    queryFn: async () => {
      let request = applyFilters(
        client.from(table).select(options.columns ?? '*'),
        options.filters,
      );
      if (options.orderBy !== undefined) {
        request = request.order(options.orderBy, {
          ascending: options.ascending ?? true,
        });
      }
      if (options.limit !== undefined) {
        request = request.limit(options.limit);
      }
      const { data, error, status } = await request;
      if (error !== null) {
        throw new OaizRequestError(error, status);
      }
      return data as Row[];
    },
  });
}

/**
 * One page of the rows of one table and the count of every matching row. The previous page stays
 * on screen while the next one loads, and through a new filter on `keepRows`. A refused read rejects
 * with `OaizRequestError`.
 */
export function usePagedRows<Row>(table: string, { keepRows, ...options }: PageOptions) {
  const { client, database, member } = useOaizData();
  const queryKey = [...pageKey(member, database, table), options];
  return useQuery({
    queryKey,
    placeholderData: keepRowsFor<RowPage<Row>>(queryKey, keepRows),
    queryFn: async (): Promise<RowPage<Row>> => {
      let request = applyFilters(
        client
          .from(table)
          .select(options.columns ?? '*', { count: 'exact' }),
        options.filters,
      );
      if (options.orderBy !== undefined) {
        request = request.order(options.orderBy, {
          ascending: options.ascending ?? true,
        });
      }
      const from = options.page * options.pageSize;
      const { data, error, count, status } = await request.range(
        from,
        from + options.pageSize - 1,
      );
      if (error !== null) {
        throw new OaizRequestError(error, status);
      }
      return { rows: data as Row[], count: count ?? 0 };
    },
  });
}

export type RowOptions = {
  /** The key column; `id` when omitted. */
  idColumn?: string;
  columns?: string;
};

/**
 * One row by its key. It is `undefined` while no id is given. A missing row and a refused read
 * reject with `OaizRequestError`.
 */
export function useRow<Row>(
  table: string,
  id: RowId | undefined,
  options: RowOptions = {},
) {
  const { client, database, member } = useOaizData();
  return useQuery({
    queryKey: [...rowKey(member, database, table, id ?? ''), options],
    enabled: id !== undefined,
    queryFn: () => readRow<Row>(client, table, id!, options),
  });
}

async function readRow<Row>(client: OaizClient, table: string, id: RowId, options: RowOptions) {
  const { data, error, status } = await client
    .from(table)
    .select(options.columns ?? '*')
    .eq(options.idColumn ?? 'id', id)
    .single();
  if (error !== null) {
    throw new OaizRequestError(error, status);
  }
  return data as Row;
}

/**
 * Answers a function that reads one row ahead of time, for a row's hover and focus, so that opening
 * it shows at once. Pass `useRow`'s options, which key the cache.
 */
export function usePrefetchRow<Row>(table: string, options: RowOptions = {}) {
  const { client, database, member } = useOaizData();
  const queryClient = useQueryClient();
  return (id: RowId) => {
    void queryClient.prefetchQuery({
      queryKey: [...rowKey(member, database, table, id), options],
      queryFn: () => readRow<Row>(client, table, id, options),
    });
  };
}

/** The writes of each table that have started and not settled, per query client. */
const savingWrites = new WeakMap<QueryClient, Map<string, number>>();

function startWrite(queryClient: QueryClient, prefix: readonly unknown[]) {
  const saving = savingWrites.get(queryClient) ?? new Map<string, number>();
  savingWrites.set(queryClient, saving);
  const table = hashKey(prefix);
  saving.set(table, (saving.get(table) ?? 0) + 1);
}

/**
 * Refetches the table's queries when its last write settles. A refetch while another write to the
 * table is still saving would answer rows without that write and undo it on screen. The count
 * drops as each write settles, so of two writes that settle together exactly one refetches.
 */
function refetchAfterLastWrite(queryClient: QueryClient, prefix: readonly unknown[]) {
  const saving = savingWrites.get(queryClient);
  const table = hashKey(prefix);
  const left = (saving?.get(table) ?? 1) - 1;
  if (left > 0) {
    saving?.set(table, left);
    return;
  }
  saving?.delete(table);
  return queryClient.invalidateQueries({ queryKey: prefix });
}

/**
 * Inserts rows into one table and answers the inserted rows. The new rows show when OAIZ has saved
 * them, because OAIZ fills their key and defaults. A refused insert rejects with `OaizRequestError`.
 * The table's queries refetch when the last write to the table settles.
 */
export function useInsertRow<
  Insert extends Record<string, unknown>,
  Row = Insert,
>(table: string) {
  const { client, database, member } = useOaizData();
  const queryClient = useQueryClient();
  const prefix = tableKey(member, database, table);
  return useMutation({
    mutationFn: async (values: Insert | Insert[]) => {
      const { data, error, status } = await client
        .from(table)
        .insert(values)
        .select();
      if (error !== null) {
        throw new OaizRequestError(error, status);
      }
      return data as Row[];
    },
    onMutate: () => startWrite(queryClient, prefix),
    onSettled: () => refetchAfterLastWrite(queryClient, prefix),
  });
}

type Snapshot = [QueryKey, unknown][];
type CachedRow = Record<string, unknown>;

/**
 * Changes every cached row of one table whose key is `id`: in lists, in pages and as a single row.
 * `change` answers the new row, or `null` to remove it. Answers the cache before the change.
 */
function patchCachedRows(
  queryClient: QueryClient,
  prefix: readonly unknown[],
  idColumn: string,
  id: RowId,
  change: (row: CachedRow) => CachedRow | null,
): Snapshot {
  const snapshot = queryClient.getQueriesData({ queryKey: prefix });
  const patch = (rows: CachedRow[]) =>
    rows.flatMap((row) => {
      if (row[idColumn] !== id) return [row];
      const next = change(row);
      return next === null ? [] : [next];
    });
  for (const [key, data] of snapshot) {
    if (data === undefined) continue;
    const kind = key[prefix.length];
    if (kind === 'rows' && Array.isArray(data)) {
      queryClient.setQueryData(key, patch(data));
    } else if (kind === 'page') {
      const page = data as RowPage<CachedRow>;
      const rows = patch(page.rows);
      queryClient.setQueryData(key, {
        rows,
        count: page.count - (page.rows.length - rows.length),
      });
    } else if (kind === 'row' && key[prefix.length + 1] === id) {
      const next = change(data as CachedRow);
      if (next !== null) queryClient.setQueryData(key, next);
    }
  }
  return snapshot;
}

/**
 * Undoes one refused write to the row whose key is `id`, from the cache before that write. Only
 * that row goes back, and after an update only the columns that still hold what it wrote, so
 * another write that is still saving stays on screen, also in the same column. `written` is
 * `null` after a delete: the row returns where it was.
 */
function undoRowWrite(
  queryClient: QueryClient,
  prefix: readonly unknown[],
  snapshot: Snapshot | undefined,
  idColumn: string,
  id: RowId,
  written: CachedRow | null,
) {
  const undo = (before: CachedRow, now: CachedRow) => {
    if (written === null) return before;
    const back = Object.keys(written).filter((column) => Object.is(now[column], written[column]));
    return { ...now, ...Object.fromEntries(back.map((column) => [column, before[column]])) };
  };
  const undoIn = (before: CachedRow[], now: CachedRow[]) => {
    const was = before.findIndex((row) => row[idColumn] === id);
    if (was < 0) return now;
    const is = now.findIndex((row) => row[idColumn] === id);
    if (is >= 0) return now.map((row, index) => (index === is ? undo(before[was], row) : row));
    // An update leaves a row that another write removed where it is.
    if (written !== null) return now;
    return [...now.slice(0, was), before[was], ...now.slice(was)];
  };
  for (const [key, before] of snapshot ?? []) {
    const now = queryClient.getQueryData(key);
    if (before === undefined || now === undefined) continue;
    const kind = key[prefix.length];
    if (kind === 'rows' && Array.isArray(before) && Array.isArray(now)) {
      queryClient.setQueryData(key, undoIn(before, now));
    } else if (kind === 'page') {
      const page = now as RowPage<CachedRow>;
      const rows = undoIn((before as RowPage<CachedRow>).rows, page.rows);
      queryClient.setQueryData(key, { rows, count: page.count + rows.length - page.rows.length });
    } else if (kind === 'row' && key[prefix.length + 1] === id) {
      queryClient.setQueryData(key, undo(before as CachedRow, now as CachedRow));
    }
  }
}

export type UpdateRow<Values> = { id: RowId; values: Values };

export type RowWriteOptions<Variables> = {
  idColumn?: string;
  /**
   * Runs for every refused write, after its change left the cache. Callbacks passed to `mutate`
   * run only for the latest call, so a refusal that must always show belongs here.
   */
  onError?: (error: Error, variables: Variables) => void;
};

/**
 * Updates one row by its key. The cached rows change at once; when OAIZ refuses, the columns this
 * update wrote change back, unless a later write changed them again. A row that a row policy hides or blocks rejects with
 * `OaizRequestError`, as a refused update does. The table's queries refetch when the last write to
 * the table settles.
 */
export function useUpdateRow<
  Values extends Record<string, unknown>,
  Row = Values,
>(table: string, options: RowWriteOptions<UpdateRow<Values>> = {}) {
  const { client, database, member } = useOaizData();
  const queryClient = useQueryClient();
  const idColumn = options.idColumn ?? 'id';
  const prefix = tableKey(member, database, table);
  return useMutation({
    mutationFn: async ({ id, values }: UpdateRow<Values>) => {
      // `.single()` turns "no row changed" into an error: a row policy blocks without one.
      const { data, error, status } = await client
        .from(table)
        .update(values)
        .eq(idColumn, id)
        .select()
        .single();
      if (error !== null) {
        throw new OaizRequestError(error, status);
      }
      return data as Row;
    },
    onMutate: async ({ id, values }) => {
      startWrite(queryClient, prefix);
      await queryClient.cancelQueries({ queryKey: prefix });
      return patchCachedRows(queryClient, prefix, idColumn, id, (row) => ({ ...row, ...values }));
    },
    onError: (error, variables, snapshot) => {
      undoRowWrite(queryClient, prefix, snapshot, idColumn, variables.id, variables.values);
      options.onError?.(error, variables);
    },
    onSettled: () => refetchAfterLastWrite(queryClient, prefix),
  });
}

/**
 * Deletes one row by its key. The row leaves the cache at once and comes back where it was when
 * OAIZ refuses. A row that a row policy hides or blocks rejects with `OaizRequestError`. The
 * table's queries refetch when the last write to the table settles.
 */
export function useDeleteRow(table: string, options: RowWriteOptions<RowId> = {}) {
  const { client, database, member } = useOaizData();
  const queryClient = useQueryClient();
  const idColumn = options.idColumn ?? 'id';
  const prefix = tableKey(member, database, table);
  return useMutation({
    mutationFn: async (id: RowId) => {
      const { error, status } = await client
        .from(table)
        .delete()
        .eq(idColumn, id)
        .select(idColumn)
        .single();
      if (error !== null) {
        throw new OaizRequestError(error, status);
      }
    },
    onMutate: async (id) => {
      startWrite(queryClient, prefix);
      await queryClient.cancelQueries({ queryKey: prefix });
      return patchCachedRows(queryClient, prefix, idColumn, id, () => null);
    },
    onError: (error, id, snapshot) => {
      undoRowWrite(queryClient, prefix, snapshot, idColumn, id, null);
      options.onError?.(error, id);
    },
    onSettled: () => refetchAfterLastWrite(queryClient, prefix),
  });
}

/** How long a delete waits for an undo before it is sent. */
const UNDO_WINDOW_MS = 5000;

/**
 * Deletes rows with an undo window, as a mail app does: `remove(id)` hides the row at once and
 * sends the delete when the window ends, and the `undo` it answers brings the row back while the
 * window is open. Show the undo in a toast. A delete still in its window is sent when the screen
 * unmounts or the page is hidden. A refused delete brings the row back and calls `onError`.
 */
export function useUndoableDeleteRow(
  table: string,
  options: RowWriteOptions<RowId> & { undoWindowMs?: number } = {},
) {
  const { client, database, member } = useOaizData();
  const queryClient = useQueryClient();
  const idColumn = options.idColumn ?? 'id';
  const prefix = tableKey(member, database, table);
  const latest = useRef({ client, queryClient, idColumn, prefix, table, options });
  latest.current = { client, queryClient, idColumn, prefix, table, options };
  type PendingDelete = {
    id: RowId;
    key: string;
    context: typeof latest.current;
    timer?: ReturnType<typeof setTimeout>;
    snapshot: Snapshot;
  };
  const waiting = useRef(new Set<PendingDelete>());

  const send = useCallback(async (entry: PendingDelete) => {
    if (!waiting.current.delete(entry)) return;
    clearTimeout(entry.timer);
    const { id, context } = entry;
    try {
      const { error, status } = await context.client
        .from(context.table)
        .delete()
        .eq(context.idColumn, id)
        .select(context.idColumn)
        .single();
      if (error !== null) {
        throw new OaizRequestError(error, status);
      }
    } catch (error) {
      undoRowWrite(context.queryClient, context.prefix, entry.snapshot, context.idColumn, id, null);
      context.options.onError?.(error as Error, id);
    } finally {
      void refetchAfterLastWrite(context.queryClient, context.prefix);
    }
  }, []);

  useEffect(() => {
    const sendAll = () => {
      for (const entry of [...waiting.current]) void send(entry);
    };
    window.addEventListener('pagehide', sendAll);
    return () => {
      window.removeEventListener('pagehide', sendAll);
      sendAll();
    };
  }, [send]);

  const remove = useCallback(
    (id: RowId) => {
      const context = latest.current;
      const key = hashKey([...context.prefix, context.idColumn, id]);
      let entry = [...waiting.current].find((pending) =>
        pending.key === key && pending.context.client === context.client &&
        pending.context.queryClient === context.queryClient,
      );
      if (!entry) {
        // The open write keeps another write's refetch from showing the row again.
        startWrite(context.queryClient, context.prefix);
        void context.queryClient.cancelQueries({ queryKey: context.prefix });
        const snapshot = patchCachedRows(context.queryClient, context.prefix, context.idColumn, id, () => null);
        entry = { id, key, context, snapshot };
        waiting.current.add(entry);
        const pending = entry;
        pending.timer = setTimeout(() => void send(pending), context.options.undoWindowMs ?? UNDO_WINDOW_MS);
      }
      const pending = entry;
      return {
        /** Brings this operation's row back; false when its delete was already sent or undone. */
        undo: () => {
          if (!waiting.current.delete(pending)) return false;
          clearTimeout(pending.timer);
          const at = pending.context;
          undoRowWrite(at.queryClient, at.prefix, pending.snapshot, at.idColumn, pending.id, null);
          void refetchAfterLastWrite(at.queryClient, at.prefix);
          return true;
        },
      };
    },
    [send],
  );

  return { remove };
}
