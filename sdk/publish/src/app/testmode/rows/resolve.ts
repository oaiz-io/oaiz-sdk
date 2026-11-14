// Mirrors how the OAIZ server resolves a table request against the catalog for document reads and writes.

import { stringifyJson, type JsonObject } from "../json";
import {
  catalogColumn,
  type CatalogColumn,
  type CatalogTable,
  type TableCatalog,
  type TableRelationship,
} from "./catalog";
import {
  columnNotFoundError,
  embedPathNotFoundError,
  filterRequiredError,
  invalidBodyError,
  limitError,
  payloadColumnNotFoundError,
  tableNotFoundError,
  tableRequestError,
} from "./errors";
import {
  emptyFilter,
  maxTableDocumentRows,
  maxTableEmbedDepth,
  maxTableEmbeds,
  maxTableFilterConditions,
  maxTableInValues,
  maxTableNodeRows,
  maxTableOrderTerms,
  maxTableWriteKeySets,
  validateTableAlias,
  type TableAggregate,
  type TableCondition,
  type TableConflictResolution,
  type TableCount,
  type TableEmbed,
  type TableEmbedFilter,
  type TableFilter,
  type TableOrder,
  type TableRead,
  type TableSelectItem,
  type TableWrite,
  type TableWriteKind,
} from "./table";

/**
 * A read whose every name was found in the catalog. Order ends with the primary-key tie-break, or
 * the groups of an aggregated read.
 */
export interface ResolvedTableRead {
  root: ResolvedTableNode;
  order: TableOrder[];
  limit: number;
  offset: bigint;
  count: TableCount;
  singular: boolean;
}

/** One table of a read. Columns come first in the output and embeds after them. */
export interface ResolvedTableNode {
  table: string;
  columns: ResolvedTableColumn[];
  embeds: ResolvedTableEmbed[];
  filter: TableFilter;
}

/** One output column. An aggregate always has an alias, and a count of rows has no name. */
export interface ResolvedTableColumn {
  name: string;
  alias: string;
  aggregate?: TableAggregate;
}

/** Whether the node reads an aggregate. */
export function isAggregated(node: ResolvedTableNode): boolean {
  return node.columns.some((column) => column.aggregate !== undefined);
}

/** The columns an aggregated node groups its rows by. */
export function groupColumns(node: ResolvedTableNode): string[] {
  const columns = node.columns.filter((column) => column.aggregate === undefined);
  return [...new Set(columns.map((column) => column.name))];
}

/** One embed over a found relationship. One that is not projected only filters its parent. */
export interface ResolvedTableEmbed {
  name: string;
  relationship: TableRelationship;
  inner: boolean;
  projected: boolean;
  node: ResolvedTableNode;
  /** The name the request embedded, which an embedded filter path can also use. */
  relation: string;
}

/**
 * Resolves every name of read against catalog and appends the primary-key tie-break, or an
 * aggregated read's groups. An aggregate reads at the top level only, and never beside * or an
 * embed.
 */
export function resolveTableRead(read: TableRead, catalog: TableCatalog): ResolvedTableRead {
  if (read.limit !== undefined && read.limit < 0)
    throw tableRequestError("invalid", "the limit must not be negative");
  if (read.offset < BigInt(0))
    throw tableRequestError("invalid", "the offset must not be negative");
  if (read.select.some((item) => item.aggregate !== undefined)) {
    if (read.select.some((item) => item.star === true || item.embed !== undefined)) {
      throw tableRequestError("unsupported", "an aggregate cannot be read beside * or an embed");
    }
  }
  const table = catalog.table(read.table);
  if (table === undefined) throw tableNotFoundError(read.table);

  const resolver = new TableReadResolver(catalog, true);
  const root = resolver.node(table, read.select, 0);
  root.filter = resolver.filter(table, read.filter);
  for (const embedFilter of read.embedFilters) resolver.attachEmbedFilter(root, embedFilter);
  requireUniqueAggregatedKeys(root);
  const order = isAggregated(root)
    ? resolveAggregatedOrder(table, read.order, groupColumns(root))
    : resolveTableOrder(table, read.order);
  const limit =
    read.limit === undefined ? maxTableNodeRows : Math.min(read.limit, maxTableNodeRows);
  requireBoundedFanOut(root, limit);
  return { root, order, limit, offset: read.offset, count: read.count, singular: read.singular };
}

/**
 * Refuses a projection whose to-many embeds below a repeated row can together return more than
 * maxTableDocumentRows rows. rows is the most rows root can return.
 */
function requireBoundedFanOut(root: ResolvedTableNode, rows: number): void {
  let repeatedRows = 0;
  const visit = (node: ResolvedTableNode, path: string, rows: number, repeated: boolean): void => {
    for (const embed of node.embeds) {
      if (!embed.projected) continue;
      const embedPath = path === "" ? embed.name : `${path}.${embed.name}`;
      let childRows = rows;
      let childRepeated = repeated;
      if (embed.relationship.cardinality === "many-to-one") childRepeated = true;
      if (embed.relationship.cardinality === "one-to-many") {
        childRows = rows * maxTableNodeRows;
        if (repeated) {
          repeatedRows += childRows;
          if (repeatedRows > maxTableDocumentRows) {
            throw limitError(
              `the embeds under repeated rows can return more than ${maxTableDocumentRows} rows, at ${embedPath}`,
            );
          }
        }
      }
      visit(embed.node, embedPath, childRows, childRepeated);
    }
  };
  visit(root, "", rows, false);
}

/**
 * Carries the counts that are limited across the whole request rather than per node. aggregates
 * admits an aggregate at the top of the select.
 */
class TableReadResolver {
  private embeds = 0;
  private conditions = 0;

  constructor(
    private readonly catalog: TableCatalog,
    private readonly aggregates: boolean,
  ) {}

  node(table: CatalogTable, items: TableSelectItem[], depth: number): ResolvedTableNode {
    const node: ResolvedTableNode = {
      table: table.name,
      columns: [],
      embeds: [],
      filter: emptyFilter(),
    };
    for (const item of items.length === 0 ? [{ star: true }] : items) {
      requireOneSelectForm(item);
      if (item.star) {
        for (const column of table.columns) node.columns.push({ name: column.name, alias: "" });
      } else if (item.embed) {
        node.embeds.push(this.embed(table, item.embed, depth + 1));
      } else if (item.aggregate !== undefined) {
        node.columns.push(this.aggregate(table, item, depth));
      } else {
        const column = item.column ?? "";
        if (catalogColumn(table, column) === undefined)
          throw columnNotFoundError(table.name, column);
        if (item.alias) validateTableAlias(item.alias);
        node.columns.push({ name: column, alias: item.alias ?? "" });
      }
    }
    return node;
  }

  private aggregate(
    table: CatalogTable,
    item: TableSelectItem,
    depth: number,
  ): ResolvedTableColumn {
    if (!this.aggregates)
      throw tableRequestError("unsupported", "a write cannot return an aggregate");
    if (depth > 0) throw tableRequestError("unsupported", "an embed cannot read an aggregate");
    const column = item.column ?? "";
    if (column !== "" && catalogColumn(table, column) === undefined)
      throw columnNotFoundError(table.name, column);
    const aggregate = item.aggregate as TableAggregate;
    const alias = item.alias || aggregate;
    validateTableAlias(alias);
    return { name: column, alias, aggregate };
  }

  private embed(parent: CatalogTable, embed: TableEmbed, depth: number): ResolvedTableEmbed {
    if (depth > maxTableEmbedDepth)
      throw limitError(`embeds nest deeper than ${maxTableEmbedDepth} levels`);
    this.embeds++;
    if (this.embeds > maxTableEmbeds)
      throw limitError(`the request embeds more than ${maxTableEmbeds} relations`);
    if (embed.relation === "") throw tableRequestError("invalid", "an embed must name a relation");
    if (embed.alias !== "") validateTableAlias(embed.alias);
    const relationship = this.catalog.relationship(parent.name, embed.relation, embed.hint);
    const table = this.catalog.table(relationship.foreignTable);
    if (table === undefined) throw tableNotFoundError(relationship.foreignTable);
    const projected = embed.select.length > 0;
    return {
      name: embed.alias !== "" ? embed.alias : embed.relation,
      relationship,
      inner: embed.inner,
      projected,
      node: projected
        ? this.node(table, embed.select, depth)
        : { table: table.name, columns: [], embeds: [], filter: emptyFilter() },
      relation: embed.relation,
    };
  }

  /** ANDs one embedded condition onto the embed its path names, by alias first, then by relation. */
  attachEmbedFilter(root: ResolvedTableNode, embedFilter: TableEmbedFilter): void {
    if (embedFilter.path.length === 0)
      throw tableRequestError("invalid", "an embedded filter must name an embed");
    let node = root;
    for (const name of embedFilter.path) {
      const embed =
        node.embeds.find((candidate) => candidate.name === name) ??
        node.embeds.find((candidate) => candidate.relation === name);
      if (embed === undefined) throw embedPathNotFoundError(name);
      node = embed.node;
    }
    const table = this.catalog.table(node.table);
    if (table === undefined) throw tableNotFoundError(node.table);
    this.condition(table, embedFilter.condition);
    node.filter.terms.push({ condition: embedFilter.condition });
  }

  filter(table: CatalogTable, filter: TableFilter): TableFilter {
    this.group(table, filter, 0);
    return filter;
  }

  /** Conditions are counted only at the leaves, so the depth is bounded as well. */
  private group(table: CatalogTable, group: TableFilter, depth: number): void {
    if (depth > maxTableFilterConditions) {
      throw limitError(`logic groups nest deeper than ${maxTableFilterConditions} levels`);
    }
    if (group.terms.length === 0 && depth > 0) {
      throw tableRequestError("invalid", "a logic group must hold at least one condition");
    }
    for (const term of group.terms) {
      if (term.condition && !term.group) this.condition(table, term.condition);
      else if (term.group && !term.condition) this.group(table, term.group, depth + 1);
      else throw tableRequestError("invalid", "a filter term must be one condition or one group");
    }
  }

  private condition(table: CatalogTable, condition: TableCondition): void {
    this.conditions++;
    if (this.conditions > maxTableFilterConditions) {
      throw limitError(`the request has more than ${maxTableFilterConditions} filter conditions`);
    }
    if (catalogColumn(table, condition.column) === undefined)
      throw columnNotFoundError(table.name, condition.column);
    if (condition.operator === "in" && condition.values.length > maxTableInValues) {
      throw limitError(`an in list holds more than ${maxTableInValues} values`);
    }
  }
}

function requireOneSelectForm(item: TableSelectItem): void {
  const named = (item.column ?? "") !== "" || item.aggregate === "count";
  const forms = [item.star === true, named, item.embed !== undefined].filter(Boolean).length;
  if (forms !== 1 || (((item.alias ?? "") !== "" || item.aggregate !== undefined) && !named)) {
    throw tableRequestError(
      "invalid",
      "a select item must be *, one column, one aggregate or one embed",
    );
  }
}

/**
 * Refuses an aggregated read with two values under one output key, because its document would keep
 * only the last.
 */
function requireUniqueAggregatedKeys(node: ResolvedTableNode): void {
  if (!isAggregated(node)) return;
  const keys = new Set<string>();
  for (const column of node.columns) {
    const key = column.alias || column.name;
    if (keys.has(key)) {
      throw tableRequestError(
        "invalid",
        `the select reads more than one value into ${JSON.stringify(key)}; give one an alias`,
      );
    }
    keys.add(key);
  }
}

/**
 * Keeps an aggregated read's order to the columns it groups by, and ends it with the other groups:
 * one row of each group makes the groups a stable order.
 */
function resolveAggregatedOrder(
  table: CatalogTable,
  order: TableOrder[],
  groups: string[],
): TableOrder[] {
  const resolved = resolveTableOrder({ ...table, primaryKey: [] }, order);
  if (resolved.some((term) => !groups.includes(term.column))) {
    throw tableRequestError(
      "unsupported",
      "an aggregated read can order only by a column it groups by",
    );
  }
  for (const column of groups) {
    if (!resolved.some((term) => term.column === column))
      resolved.push({ column, descending: false, nulls: "" });
  }
  return resolved;
}

function resolveTableOrder(table: CatalogTable, order: TableOrder[]): TableOrder[] {
  if (order.length > maxTableOrderTerms)
    throw limitError(`the order has more than ${maxTableOrderTerms} terms`);
  const resolved: TableOrder[] = [];
  for (const term of order) {
    if (catalogColumn(table, term.column) === undefined)
      throw columnNotFoundError(table.name, term.column);
    resolved.push(term);
  }
  for (const column of table.primaryKey) {
    if (!resolved.some((term) => term.column === column))
      resolved.push({ column, descending: false, nulls: "" });
  }
  return resolved;
}

/** A write whose every name was found and whose body was divided among the statements it needs. */
export interface ResolvedTableWrite {
  table: string;
  kind: TableWriteKind;
  /** One group per statement: an insert has one, or one per key set; an update at most one. */
  groups: ResolvedTableWriteGroup[];
  conflictColumns: string[];
  resolution: TableConflictResolution;
  /** The payload columns of an insert, in catalog order, which a merge sets. */
  mergeColumns: string[];
  filter: TableFilter;
  /** Shapes the returned rows; undefined returns none. */
  representation: ResolvedTableNode | undefined;
  count: TableCount;
  singular: boolean;
}

/** One statement's share of the payload: its columns in catalog order and its rows as JSON text. */
export interface ResolvedTableWriteGroup {
  columns: CatalogColumn[];
  rows: string;
}

/** Resolves every name of write against catalog and checks its body. */
export function resolveTableWrite(write: TableWrite, catalog: TableCatalog): ResolvedTableWrite {
  const table = catalog.table(write.table);
  if (table === undefined) throw tableNotFoundError(write.table);
  if (table.kind === "view") {
    throw tableRequestError("unsupported", `data.${table.name} is a view, and views are read only`);
  }
  const resolved: ResolvedTableWrite = {
    table: table.name,
    kind: write.kind,
    groups: [],
    conflictColumns: [],
    resolution: "",
    mergeColumns: [],
    filter: emptyFilter(),
    representation: undefined,
    count: write.count,
    singular: write.singular,
  };
  // An update or delete can change any number of rows, so it gets the whole budget; an insert
  // returns at most one row per object.
  let representationRows = maxTableDocumentRows;
  if (write.kind === "insert") {
    const payload = resolveTableInsertPayload(write, table);
    resolved.groups = payload.groups;
    resolved.mergeColumns = payload.merged;
    representationRows = payload.objects;
    [resolved.conflictColumns, resolved.resolution] = resolveTableConflict(write, table);
  } else if (write.kind === "update") {
    resolved.groups = resolveTableUpdatePayload(write, table);
  }

  const resolver = new TableReadResolver(catalog, false);
  if (write.kind !== "insert") {
    if (write.filter.terms.length === 0) throw filterRequiredError(write.kind);
    resolved.filter = resolver.filter(table, write.filter);
  }
  // The select and its embedded filters are resolved whether or not rows are returned, so a
  // relationship or a filter path that does not resolve is refused and never ignored.
  const representation = resolver.node(table, write.select, 0);
  for (const embedFilter of write.embedFilters)
    resolver.attachEmbedFilter(representation, embedFilter);
  if (write.representation) {
    requireBoundedFanOut(representation, representationRows);
    resolved.representation = representation;
  }
  return resolved;
}

/** One object of a write body: its keys and its text as the OAIZ server re-encodes it. */
interface TableWriteObject {
  keys: string[];
  raw: string;
}

function writeObjects(body: (JsonObject | null)[]): TableWriteObject[] {
  return body.map((object) => {
    if (object === null) throw invalidBodyError("Empty or invalid json");
    return { keys: [...object.keys()], raw: stringifyJson(object) };
  });
}

/** Checks that every object of a body without a column list gives the keys of the first. */
function sharedKeys(objects: TableWriteObject[]): Set<string> {
  const first = new Set(objects[0]?.keys ?? []);
  for (const object of objects.slice(1)) {
    const keys = new Set(object.keys);
    if (keys.size !== first.size || [...keys].some((key) => !first.has(key))) {
      throw invalidBodyError("All object keys must match");
    }
  }
  return first;
}

/** The payload columns: the column list when one is given, else the keys every object shares. */
function resolveTablePayloadColumns(
  write: TableWrite,
  table: CatalogTable,
  shared: Set<string>,
): Set<string> {
  const payload = new Set<string>();
  const names = write.columns ?? [...shared].sort();
  for (const name of names) {
    if (catalogColumn(table, name) === undefined)
      throw payloadColumnNotFoundError(table.name, name);
    payload.add(name);
  }
  return payload;
}

function catalogColumnsIn(table: CatalogTable, names: (name: string) => boolean): CatalogColumn[] {
  return table.columns.filter((column) => names(column.name));
}

function resolveTableInsertPayload(
  write: TableWrite,
  table: CatalogTable,
): { groups: ResolvedTableWriteGroup[]; merged: string[]; objects: number } {
  const objects = writeObjects((write.body ?? []) as (JsonObject | null)[]);
  // Without a column list every object gives the same keys, so only a listed insert can have more
  // than one key set.
  const grouped = write.missingDefault && write.columns !== undefined;
  const shared = write.columns === undefined ? sharedKeys(objects) : new Set<string>();
  const payload = resolveTablePayloadColumns(write, table, shared);
  const columns = catalogColumnsIn(table, (name) => payload.has(name));
  const merged = columns.map((column) => column.name);
  if (!grouped || objects.length === 0) {
    return {
      groups: [{ columns, rows: `[${objects.map((object) => object.raw).join(",")}]` }],
      merged,
      objects: objects.length,
    };
  }
  // Each key set is one statement that names only the listed columns its objects give, so every
  // column a row omits takes its default.
  const listed = write.columns!;
  const sets = new Map<string, TableWriteObject[]>();
  for (const object of objects) {
    const signature = listed.map((name) => (object.keys.includes(name) ? "1" : "0")).join("");
    if (!sets.has(signature)) {
      if (sets.size === maxTableWriteKeySets) {
        throw limitError(`the rows have more than ${maxTableWriteKeySets} different key sets`);
      }
      sets.set(signature, []);
    }
    sets.get(signature)!.push(object);
  }
  const groups = [...sets].map(([signature, members]) => ({
    columns: catalogColumnsIn(table, (name) => {
      const position = listed.indexOf(name);
      return position >= 0 && signature[position] === "1";
    }),
    rows: `[${members.map((object) => object.raw).join(",")}]`,
  }));
  return { groups, merged, objects: objects.length };
}

/** The one object an update sets. */
function resolveTableUpdatePayload(
  write: TableWrite,
  table: CatalogTable,
): ResolvedTableWriteGroup[] {
  const [object] = writeObjects([(write.body ?? null) as JsonObject | null]);
  const shared = new Set(object.keys);
  const payload = resolveTablePayloadColumns(write, table, shared);
  const columns = catalogColumnsIn(table, (name) => payload.has(name));
  if (columns.length === 0) throw invalidBodyError("the payload sets no column");
  return [{ columns, rows: object.raw }];
}

/** The conflict target of an upsert: the listed columns, else the primary key. */
function resolveTableConflict(
  write: TableWrite,
  table: CatalogTable,
): [string[], TableConflictResolution] {
  for (const name of write.onConflict) {
    if (catalogColumn(table, name) === undefined) throw columnNotFoundError(table.name, name);
  }
  if (write.resolution === "") return [[], ""];
  const target = write.onConflict.length > 0 ? write.onConflict : table.primaryKey;
  if (target.length === 0) return [[], ""];
  return [[...target], write.resolution];
}
