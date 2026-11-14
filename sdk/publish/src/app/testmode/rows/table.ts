// Mirrors the OAIZ server's table requests for the document reads and writes the rows routes build.

import type { JsonObject } from "../json";
import { tableRequestError } from "./errors";

/** How deeply embeds may nest under the requested table. */
export const maxTableEmbedDepth = 3;
/** How many embeds one request may name in total. */
export const maxTableEmbeds = 12;
/** Every condition of the request, embedded filters included. */
export const maxTableFilterConditions = 64;
/** How many values one in list may carry. */
export const maxTableInValues = 1000;
/** The requested order terms, before the primary-key tie-break is appended. */
export const maxTableOrderTerms = 16;
/** The most rows each read node returns; a larger limit is lowered to it. */
export const maxTableNodeRows = 1000;
/** The rows the to-many embeds below a repeated many-to-one row can return together. */
export const maxTableDocumentRows = maxTableNodeRows * maxTableNodeRows;
/** How many distinct key sets the rows of one insert may have when omitted columns take defaults. */
export const maxTableWriteKeySets = 16;
const maxTableAliasBytes = 63;

export type TableCount = "" | "exact";

export type TableOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in"
  | "is";

export type TableIsValue = "null" | "true" | "false";

export type TableNullsOrder = "" | "first" | "last";

export interface TableRead {
  table: string;
  /** The output list. An empty list selects every column. */
  select: TableSelectItem[];
  filter: TableFilter;
  embedFilters: TableEmbedFilter[];
  order: TableOrder[];
  /** The requested page size. Undefined asks for maxTableNodeRows. */
  limit: number | undefined;
  offset: bigint;
  count: TableCount;
  singular: boolean;
}

export type TableWriteKind = "insert" | "update" | "delete";

export type TableConflictResolution = "" | "merge" | "ignore";

export interface TableWrite {
  table: string;
  kind: TableWriteKind;
  /**
   * The payload: the rows of an insert or the one object of an update, each object as the OAIZ server
   * re-encodes it. A delete has none.
   */
  body: JsonObject[] | JsonObject | undefined;
  /** The payload columns, or undefined when they are the keys every object shares. */
  columns: string[] | undefined;
  onConflict: string[];
  resolution: TableConflictResolution;
  missingDefault: boolean;
  filter: TableFilter;
  embedFilters: TableEmbedFilter[];
  /** Returns the changed rows, shaped by select. */
  representation: boolean;
  select: TableSelectItem[];
  count: TableCount;
  singular: boolean;
}

/** A function a select item applies over a read's rows. */
export type TableAggregate = "avg" | "count" | "max" | "min" | "sum";

/**
 * One entry of a select list: every column, one column, one aggregate, or one embedded relation.
 * A count aggregate without a column counts rows, and the other columns of the select group them.
 */
export interface TableSelectItem {
  star?: boolean;
  column?: string;
  aggregate?: TableAggregate;
  alias?: string;
  embed?: TableEmbed;
}

export interface TableEmbed {
  relation: string;
  alias: string;
  hint: string;
  inner: boolean;
  select: TableSelectItem[];
}

export interface TableEmbedFilter {
  path: string[];
  condition: TableCondition;
}

/** A group of terms joined by AND, or by OR when `or` is set. */
export interface TableFilter {
  or: boolean;
  negated: boolean;
  terms: TableFilterTerm[];
}

/** One condition or one nested group. Exactly one is set. */
export interface TableFilterTerm {
  condition?: TableCondition;
  group?: TableFilter;
}

export interface TableCondition {
  column: string;
  operator: TableOperator;
  negated: boolean;
  value: string;
  values: string[];
  is: TableIsValue | "";
}

export interface TableOrder {
  column: string;
  descending: boolean;
  nulls: TableNullsOrder;
}

export interface TableStatement {
  sql: string;
  args: string[];
}

/**
 * What one read or write returned. `total` is the count a request asked for, as PostgreSQL's
 * digits; `body` is the JSON text of the rows, or of the one row of a single request.
 */
export interface TableReadResult {
  total: string | null;
  returned: number;
  body: string | null;
}

export function emptyFilter(): TableFilter {
  return { or: false, negated: false, terms: [] };
}

/** Refuses an output name that is not a plain identifier. */
export function validateTableAlias(alias: string): void {
  if (
    new TextEncoder().encode(alias).length > maxTableAliasBytes ||
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)
  ) {
    throw tableRequestError(
      "invalid",
      "the alias must be a letter or underscore followed by letters, digits or underscores, at most 63 bytes",
    );
  }
}
