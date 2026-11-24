import { useCallback, useEffect, useRef, useState } from 'react';

import { PropertyPicker, type PropertyPickerProps } from './property-picker';
import { RecordMark } from './record-name';

type Person = { id: string; name: string };
type ListError = { message: string };
type ListParams = { query?: string; cursor?: string; userId?: string };
type PeopleClient = {
  listUsers(
    params: ListParams,
    options: { signal: AbortSignal },
  ): Promise<
    | { data: { items: readonly Person[]; hasMore: boolean; nextCursor: string | null }; error: null }
    | { data: null; error: ListError }
  >;
};

export type PeoplePickerProps = Pick<
  PropertyPickerProps, 'className' | 'disabled' | 'label' | 'labels' | 'placeholder' | 'value' | 'variant'
> & {
  /** The app client from `createClient({ app, ... })`. */
  client: PeopleClient;
  /** Save this user ID with the record. Clearing returns null. */
  onChange: (userId: string | null) => void;
};

type Page = {
  client: PeopleClient;
  query: string;
  people: readonly Person[];
  requestedCursor?: string;
  nextCursor: string | null;
  loading: boolean;
  error: ListError | null;
};

function optionFor({ id, name }: Person) {
  return { value: id, label: name, icon: <RecordMark name={name} round /> };
}

async function listPeople(client: PeopleClient, params: ListParams, signal: AbortSignal) {
  try {
    return await client.listUsers(params, { signal });
  } catch {
    return { data: null, error: { message: 'Could not load people.' } };
  }
}

/** Choose a person who can use this app. The saved value is their user ID. */
export function PeoplePicker({ client, value, onChange, ...props }: PeoplePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<Page>();
  const [savedPerson, setSavedPerson] = useState<{
    client: PeopleClient;
    id: string;
    person: Person | undefined;
  }>();
  const request = useRef<AbortController | null>(null);

  const loadPage = useCallback(async (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPage((previous) => ({
      client,
      query,
      people: cursor && previous?.client === client && previous.query === query ? previous.people : [],
      requestedCursor: cursor,
      nextCursor: null,
      loading: true,
      error: null,
    }));
    const { data, error } = await listPeople(client, { query, cursor }, controller.signal);
    if (controller.signal.aborted) return;
    setPage((previous) => ({
      client,
      query,
      people: [...(previous?.people ?? []), ...(data?.items ?? [])],
      requestedCursor: cursor,
      nextCursor: data?.hasMore ? data.nextCursor : null,
      loading: false,
      error,
    }));
  }, [client, query]);

  useEffect(() => {
    if (!open) return;
    void loadPage();
    return () => request.current?.abort();
  }, [loadPage, open]);

  useEffect(() => {
    if (value === null) return;
    const controller = new AbortController();
    void listPeople(client, { userId: value }, controller.signal).then(({ data }) => {
      if (controller.signal.aborted) return;
      const person = data?.items.find(({ id }) => id === value);
      setSavedPerson({ client, id: value, person });
    });
    return () => controller.abort();
  }, [client, value]);

  const active = open && page?.client === client && page.query === query ? page : undefined;
  const saved = savedPerson?.client === client && savedPerson.id === value ? savedPerson : undefined;
  const selection = saved?.person ?? active?.people.find(({ id }) => id === value);
  const unresolvedLabel = saved ? (props.labels?.unavailable ?? 'Person unavailable') : (props.labels?.loading ?? 'Loading…');
  const nextCursor = active?.nextCursor;

  return (
    <PropertyPicker
      {...props}
      value={value}
      options={active?.people.map(optionFor) ?? []}
      selectedOptions={value === null ? [] : [selection ? optionFor(selection) : { value, label: unresolvedLabel }]}
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          request.current?.abort();
          setPage(undefined);
        }
        setOpen(next);
      }}
      searchMode="remote"
      onSearchChange={setQuery}
      loading={open && (active?.loading ?? true)}
      error={active?.error}
      onRetry={active?.error ? () => void loadPage(active.requestedCursor) : undefined}
      hasMore={nextCursor != null}
      onLoadMore={nextCursor == null ? undefined : () => void loadPage(nextCursor)}
      onChange={(id) => {
        const person = active?.people.find((option) => option.id === id);
        if (person) setSavedPerson({ client, id, person });
        onChange(id);
      }}
      onClear={() => onChange(null)}
    />
  );
}
