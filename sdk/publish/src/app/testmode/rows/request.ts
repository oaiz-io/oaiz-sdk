// Mirrors the OAIZ server's rows request handling: strict decoding of the five rows request bodies and the
// function call body, the OAIZ server's validation answers, and the select grammar and the filters.

import {
  JsonNumber,
  JsonSyntaxError,
  compareCodePoints,
  parseFirstJson,
  type JsonObject,
  type JsonValue,
} from "../json";
import { RowsRefusal, incorrectInput, slugTableRequestInvalid, type FieldError } from "./errors";
import { validateFunctionCall } from "./functions";
import {
  emptyFilter,
  maxTableEmbedDepth,
  maxTableFilterConditions,
  type TableAggregate,
  type TableCondition,
  type TableCount,
  type TableEmbed,
  type TableEmbedFilter,
  type TableFilter,
  type TableFilterTerm,
  type TableIsValue,
  type TableOperator,
  type TableOrder,
  type TableRead,
  type TableSelectItem,
  type TableWrite,
} from "./table";

export type RowsOperation = "select" | "insert" | "upsert" | "update" | "delete";

/** One rows request, mapped onto the read or write the OAIZ server runs for it. */
export type RowsRequest = { read: TableRead; write?: never } | { write: TableWrite; read?: never };

/** Reads a rows request body and maps it as the OAIZ server does, or throws the OAIZ server's refusal. */
export function decodeRowsRequest(operation: RowsOperation, body: string): RowsRequest {
  const value = readBody(body);
  switch (operation) {
    case "select":
      return { read: selectRowsRead(decodeSelect(value)) };
    case "insert": {
      const input = decodeInsert(value);
      return {
        write: insertRowsWrite(
          input.table,
          input.rows!,
          input.defaultToNull,
          input.select,
          input.count,
          input.single,
        ),
      };
    }
    case "upsert":
      return { write: upsertRowsWrite(decodeUpsert(value)) };
    case "update":
      return { write: updateRowsWrite(decodeUpdate(value)) };
    case "delete":
      return { write: deleteRowsWrite(decodeDelete(value)) };
  }
}

// ---------------------------------------------------------------------------
// Decoding. The OAIZ server decodes with Go's encoding/json, numbers kept, unknown fields refused, then
// checks the `binding:"required"` fields. Go matches a key to a field ignoring case when no field
// has the exact name, null leaves a scalar unchanged and clears a pointer, slice or map, and the
// first error in document order is the one answered.

interface RowFilterInput {
  column: string;
  operator: string;
  value?: string;
  values?: string[];
  not: boolean;
  or?: RowFilterInput[];
  and?: RowFilterInput[];
}

interface RowOrderInput {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

interface SelectInput {
  table: string;
  select: string;
  filters?: RowFilterInput[];
  order?: RowOrderInput[];
  limit?: bigint;
  offset: bigint;
  count: string;
  single: boolean;
}

/** A row of an insert; null where the body gave null in place of an object. */
type RowInput = JsonObject | null;

interface InsertInput {
  table: string;
  rows?: RowInput[];
  defaultToNull?: boolean;
  select?: string;
  count: string;
  single: boolean;
}

interface UpsertInput extends InsertInput {
  onConflict?: string[];
  ignoreDuplicates: boolean;
}

interface UpdateInput {
  table: string;
  values?: JsonObject;
  filters?: RowFilterInput[];
  select?: string;
  count: string;
  single: boolean;
}

interface DeleteInput {
  table: string;
  filters?: RowFilterInput[];
  select?: string;
  count: string;
  single: boolean;
}

/** A body that is not JSON answers the decoder's own text, as the OAIZ server's validation answer does. */
function readBody(body: string): JsonValue {
  try {
    return parseFirstJson(body);
  } catch (error) {
    if (!(error instanceof JsonSyntaxError)) throw error;
    throw new RowsRefusal(400, "invalid-input", error.message);
  }
}

function invalidJson(field: string, message: string): RowsRefusal {
  return new RowsRefusal(400, "invalid-input", "Invalid JSON input", [{ field, message }]);
}

function kindOf(value: JsonValue): string {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "string") return "string";
  if (value instanceof JsonNumber) return "number";
  if (Array.isArray(value)) return "array";
  return "object";
}

function typeError(
  goType: string,
  value: JsonValue,
  path: string,
  found = kindOf(value),
): RowsRefusal {
  if (path === "") {
    return invalidJson(
      "json",
      `Invalid JSON format: json: cannot unmarshal ${found} into Go value of type ${goType}`,
    );
  }
  const field = path.toLowerCase();
  return invalidJson(field, `Expected ${goType} for field ${field}, but got ${found}`);
}

/** Decodes a non-null value into one field; null is handled by the field's kind. */
type FieldDecoder = (value: JsonValue, path: string) => unknown;

interface FieldSpec {
  decode: FieldDecoder;
  /** A pointer, slice or map, which null sets to nil. */
  nilable: boolean;
}

function decodeStruct(
  value: JsonValue,
  path: string,
  goType: string,
  fields: Record<string, FieldSpec>,
  target: Record<string, unknown>,
): void {
  if (value === null) return;
  if (!(value instanceof Map)) throw typeError(goType, value, path);
  const names = Object.keys(fields);
  for (const [key, member] of value) {
    const name = names.includes(key)
      ? key
      : names.find((field) => field.toLowerCase() === key.toLowerCase());
    if (name === undefined)
      throw invalidJson("json", `Invalid JSON format: json: unknown field ${JSON.stringify(key)}`);
    const spec = fields[name];
    const memberPath = path === "" ? name : `${path}.${name}`;
    if (member === null) {
      if (spec.nilable) target[name] = undefined;
      continue;
    }
    target[name] = spec.decode(member, memberPath);
  }
}

const field = (decode: FieldDecoder, nilable = false): FieldSpec => ({ decode, nilable });

function decodeString(goType = "string"): FieldDecoder {
  return (value, path) => {
    if (typeof value !== "string") throw typeError(goType, value, path);
    return value;
  };
}

const decodeBool: FieldDecoder = (value, path) => {
  if (typeof value !== "boolean") throw typeError("bool", value, path);
  return value;
};

const int64Min = BigInt("-9223372036854775808");
const int64Max = BigInt("9223372036854775807");

/** A Go int, kept as a bigint so an offset past 2^53 reaches PostgreSQL with every digit. */
const decodeInt: FieldDecoder = (value, path) => {
  if (!(value instanceof JsonNumber)) throw typeError("int", value, path);
  if (!/^-?\d+$/.test(value.text)) throw typeError("int", value, path, `number ${value.text}`);
  const parsed = BigInt(value.text);
  if (parsed < int64Min || parsed > int64Max)
    throw typeError("int", value, path, `number ${value.text}`);
  return parsed;
};

function decodeSlice(goType: string, element: FieldDecoder, zero: unknown): FieldDecoder {
  return (value, path) => {
    if (!Array.isArray(value)) throw typeError(goType, value, path);
    return value.map((item) => (item === null ? zero : element(item, path)));
  };
}

const decodeObject: FieldDecoder = (value, path) => {
  if (!(value instanceof Map)) throw typeError("map[string]interface {}", value, path);
  return value;
};

const decodeFilter: FieldDecoder = (value, path) => {
  const filter: RowFilterInput = { column: "", operator: "", not: false };
  decodeStruct(
    value,
    path,
    "dto.StorageRowFilter",
    filterFields,
    filter as unknown as Record<string, unknown>,
  );
  return filter;
};

const decodeFilters = decodeSlice("[]dto.StorageRowFilter", decodeFilter, undefined);

const filterFields: Record<string, FieldSpec> = {
  column: field(decodeString()),
  operator: field(decodeString("dto.StorageRowFilterOperator")),
  value: field(decodeString(), true),
  values: field(decodeSlice("[]string", decodeString(), ""), true),
  not: field(decodeBool),
  or: field((value, path) => decodeFilters(value, path), true),
  and: field((value, path) => decodeFilters(value, path), true),
};

const decodeOrder: FieldDecoder = (value, path) => {
  const order: RowOrderInput = { column: "" };
  decodeStruct(
    value,
    path,
    "dto.StorageRowOrder",
    {
      column: field(decodeString()),
      ascending: field(decodeBool, true),
      nullsFirst: field(decodeBool, true),
    },
    order as unknown as Record<string, unknown>,
  );
  return order;
};

/** Null filters in a list decode as a filter that sets nothing. */
function filterList(
  filters: (RowFilterInput | undefined)[] | undefined,
): RowFilterInput[] | undefined {
  return filters?.map((filter) => filter ?? { column: "", operator: "", not: false });
}

const countField = field(decodeString("dto.StorageRowCount"));

/** The type the OAIZ server's answer names for a body that is not a JSON object. */
const bodyType = "dto.wire";

function decodeSelect(value: JsonValue): SelectInput {
  const input: SelectInput = {
    table: "",
    select: "",
    offset: BigInt(0),
    count: "",
    single: false,
  };
  decodeStruct(
    value,
    "",
    bodyType,
    {
      table: field(decodeString()),
      select: field(decodeString()),
      filters: field(decodeFilters, true),
      order: field(decodeSlice("[]dto.StorageRowOrder", decodeOrder, { column: "" }), true),
      limit: field(decodeInt, true),
      offset: field(decodeInt),
      count: countField,
      single: field(decodeBool),
    },
    input as unknown as Record<string, unknown>,
  );
  input.filters = filterList(input.filters);
  requireFields("selectstoragedatabaserowsinput", [["table", input.table !== ""]]);
  return input;
}

const writeFields: Record<string, FieldSpec> = {
  table: field(decodeString()),
  select: field(decodeString(), true),
  count: countField,
  single: field(decodeBool),
};

const rowsField = field(decodeSlice("[]map[string]interface {}", decodeObject, null), true);

function decodeInsert(value: JsonValue): InsertInput {
  const input: InsertInput = { table: "", count: "", single: false };
  decodeStruct(
    value,
    "",
    bodyType,
    {
      ...writeFields,
      rows: rowsField,
      defaultToNull: field(decodeBool, true),
    },
    input as unknown as Record<string, unknown>,
  );
  requireFields("insertstoragedatabaserowsinput", [
    ["table", input.table !== ""],
    ["rows", input.rows !== undefined],
  ]);
  return input;
}

function decodeUpsert(value: JsonValue): UpsertInput {
  const input: UpsertInput = { table: "", count: "", single: false, ignoreDuplicates: false };
  decodeStruct(
    value,
    "",
    bodyType,
    {
      ...writeFields,
      rows: rowsField,
      onConflict: field(decodeSlice("[]string", decodeString(), ""), true),
      ignoreDuplicates: field(decodeBool),
      defaultToNull: field(decodeBool, true),
    },
    input as unknown as Record<string, unknown>,
  );
  requireFields("upsertstoragedatabaserowsinput", [
    ["table", input.table !== ""],
    ["rows", input.rows !== undefined],
  ]);
  return input;
}

function decodeUpdate(value: JsonValue): UpdateInput {
  const input: UpdateInput = { table: "", count: "", single: false };
  decodeStruct(
    value,
    "",
    bodyType,
    {
      ...writeFields,
      values: field(decodeObject, true),
      filters: field(decodeFilters, true),
    },
    input as unknown as Record<string, unknown>,
  );
  input.filters = filterList(input.filters);
  requireFields("updatestoragedatabaserowsinput", [
    ["table", input.table !== ""],
    ["values", input.values !== undefined],
    ["filters", input.filters !== undefined],
  ]);
  return input;
}

function decodeDelete(value: JsonValue): DeleteInput {
  const input: DeleteInput = { table: "", count: "", single: false };
  decodeStruct(
    value,
    "",
    bodyType,
    {
      ...writeFields,
      filters: field(decodeFilters, true),
    },
    input as unknown as Record<string, unknown>,
  );
  input.filters = filterList(input.filters);
  requireFields("deletestoragedatabaserowsinput", [
    ["table", input.table !== ""],
    ["filters", input.filters !== undefined],
  ]);
  return input;
}

/** A function call body: the function's name, and its arguments by name when the body gave them. */
export interface FunctionCallInput {
  name: string;
  args?: JsonObject;
}

/**
 * Reads a function call body as the OAIZ server binds it, and refuses a call no function can answer, as
 * the OAIZ server does before it reads the grant.
 */
export function decodeFunctionCall(body: string): FunctionCallInput {
  const input: FunctionCallInput = { name: "" };
  decodeStruct(
    readBody(body),
    "",
    bodyType,
    { name: field(decodeString()), args: field(decodeObject, true) },
    input as unknown as Record<string, unknown>,
  );
  requireFields("callstoragedatabasefunctioninput", [["name", input.name !== ""]]);
  validateFunctionCall(input);
  return input;
}

/** Refuses every required field the body left empty, in field order. */
function requireFields(type: string, checks: [string, boolean][]): void {
  const errors: FieldError[] = checks
    .filter(([, present]) => !present)
    .map(([name]) => ({ field: `${type}.${name}`, message: `${type}.${name} is required` }));
  if (errors.length > 0)
    throw new RowsRefusal(400, "validation-error", "Validation failed", errors);
}

// ---------------------------------------------------------------------------
// Mapping onto reads and writes.

const rowOperators: readonly TableOperator[] = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "in",
  "is",
];

const rowIsValues: readonly TableIsValue[] = ["null", "true", "false"];

function invalidRowsRequest(message: string): RowsRefusal {
  return incorrectInput(message, slugTableRequestInvalid);
}

function selectRowsRead(input: SelectInput): TableRead {
  const selection = parseRowSelect(input.select);
  const [filter, embedFilters] = rowFilters(input.filters ?? []);
  return {
    table: input.table,
    select: selection,
    filter,
    embedFilters,
    order: rowOrder(input.order ?? []),
    limit: input.limit === undefined ? undefined : Number(input.limit),
    offset: input.offset,
    count: rowCount(input.count),
    singular: input.single,
  };
}

/** Every key any row gives is a payload column, so rows may give different keys. */
function insertRowsWrite(
  table: string,
  rows: RowInput[],
  defaultToNull: boolean | undefined,
  returning: string | undefined,
  count: string,
  single: boolean,
): TableWrite {
  let columns: string[] | undefined;
  for (const row of rows) {
    for (const name of row?.keys() ?? []) {
      columns ??= [];
      if (!columns.includes(name)) columns.push(name);
    }
  }
  columns?.sort(compareCodePoints);
  const write: TableWrite = {
    table,
    kind: "insert",
    body: rows as JsonObject[],
    columns,
    onConflict: [],
    resolution: "",
    missingDefault: defaultToNull === false,
    filter: emptyFilter(),
    embedFilters: [],
    representation: false,
    select: [],
    count: "",
    singular: single,
  };
  return withRowsReturning(write, returning, count);
}

function upsertRowsWrite(input: UpsertInput): TableWrite {
  const write = insertRowsWrite(
    input.table,
    input.rows!,
    input.defaultToNull,
    input.select,
    input.count,
    input.single,
  );
  write.onConflict = input.onConflict ?? [];
  write.resolution = input.ignoreDuplicates ? "ignore" : "merge";
  return write;
}

function updateRowsWrite(input: UpdateInput): TableWrite {
  const [filter, embedFilters] = rowFilters(input.filters!);
  const write: TableWrite = {
    table: input.table,
    kind: "update",
    body: input.values,
    columns: undefined,
    onConflict: [],
    resolution: "",
    missingDefault: false,
    filter,
    embedFilters,
    representation: false,
    select: [],
    count: "",
    singular: input.single,
  };
  return withRowsReturning(write, input.select, input.count);
}

function deleteRowsWrite(input: DeleteInput): TableWrite {
  const [filter, embedFilters] = rowFilters(input.filters!);
  const write: TableWrite = {
    table: input.table,
    kind: "delete",
    body: undefined,
    columns: undefined,
    onConflict: [],
    resolution: "",
    missingDefault: false,
    filter,
    embedFilters,
    representation: false,
    select: [],
    count: "",
    singular: input.single,
  };
  return withRowsReturning(write, input.select, input.count);
}

/** Returns the changed rows in the shape returning selects, when it is set. */
function withRowsReturning(
  write: TableWrite,
  returning: string | undefined,
  count: string,
): TableWrite {
  write.count = rowCount(count);
  if (returning === undefined) return write;
  write.representation = true;
  write.select = parseRowSelect(returning);
  return write;
}

function rowCount(count: string): TableCount {
  if (count === "" || count === "exact") return count;
  throw invalidRowsRequest("count must be exact");
}

function rowOrder(order: RowOrderInput[]): TableOrder[] {
  return order.map((requested) => ({
    column: requested.column,
    descending: requested.ascending === false,
    nulls: requested.nullsFirst === undefined ? "" : requested.nullsFirst ? "first" : "last",
  }));
}

/**
 * The conditions on the table and its groups become one AND group, and each condition on an
 * embedded table narrows that table's rows.
 */
function rowFilters(filters: RowFilterInput[]): [TableFilter, TableEmbedFilter[]] {
  const group = emptyFilter();
  const embedFilters: TableEmbedFilter[] = [];
  for (const filter of filters) {
    if (filter.or !== undefined || filter.and !== undefined) {
      group.terms.push(rowFilterGroup(filter, 1));
      continue;
    }
    const path = parseRowColumnPath(filter.column);
    const condition = rowCondition(filter, path[path.length - 1]);
    if (path.length > 1) {
      embedFilters.push({ path: path.slice(0, -1), condition });
      continue;
    }
    group.terms.push({ condition });
  }
  return [group, embedFilters];
}

/** One or or and group, whose filters name columns of the table itself. */
function rowFilterGroup(filter: RowFilterInput, depth: number): TableFilterTerm {
  if (depth > maxTableFilterConditions) {
    throw invalidRowsRequest(`filter groups nest deeper than ${maxTableFilterConditions} levels`);
  }
  if (
    (filter.or !== undefined) === (filter.and !== undefined) ||
    filter.column !== "" ||
    filter.operator !== "" ||
    filter.value !== undefined ||
    filter.values !== undefined
  ) {
    throw invalidRowsRequest("a filter group sets or or and, and nothing else but not");
  }
  const members = filterList(filter.or ?? filter.and)!;
  const group: TableFilter = { or: filter.or !== undefined, negated: filter.not, terms: [] };
  if (members.length === 0) throw invalidRowsRequest("a filter group needs at least one filter");
  for (const member of members) {
    if (member.or !== undefined || member.and !== undefined) {
      group.terms.push(rowFilterGroup(member, depth + 1));
      continue;
    }
    group.terms.push({ condition: rowCondition(member, member.column) });
  }
  return { group };
}

function rowCondition(filter: RowFilterInput, column: string): TableCondition {
  if (column === "") throw invalidRowsRequest("a filter needs a column");
  const operator = rowOperators.find((candidate) => candidate === filter.operator);
  if (operator === undefined) throw invalidRowsRequest(`the filter on ${column} needs an operator`);
  const condition: TableCondition = {
    column,
    operator,
    negated: filter.not,
    value: "",
    values: [],
    is: "",
  };
  if (operator === "in") {
    if (filter.values === undefined || filter.value !== undefined) {
      throw invalidRowsRequest(`in on ${column} takes values and no value`);
    }
    condition.values = filter.values;
    return condition;
  }
  if (filter.values !== undefined) throw invalidRowsRequest("only in takes values");
  if (operator === "is") {
    const test = rowIsValues.find((candidate) => candidate === (filter.value ?? "null"));
    if (test === undefined) throw invalidRowsRequest(`is on ${column} takes null, true or false`);
    condition.is = test;
    return condition;
  }
  if (filter.value === undefined) throw invalidRowsRequest(`the filter on ${column} needs a value`);
  condition.value = filter.value;
  return condition;
}

/** A filter column: a column, or an embed path and a column separated by dots. */
function parseRowColumnPath(column: string): string[] {
  const parser = new RowSelectParser(column, "filter column");
  const path: string[] = [];
  for (;;) {
    path.push(parser.fieldName());
    if (parser.atEnd()) return path;
    if (!parser.consume(".")) throw parser.fail("expecting '.' or end of input");
  }
}

/** A select list. An empty list selects every column. */
function parseRowSelect(value: string): TableSelectItem[] {
  if (value.trim() === "") return [];
  const parser = new RowSelectParser(value, "select");
  const items = parser.selectList();
  if (!parser.atEnd()) throw parser.fail("expecting ',' or end of input");
  return items;
}

const rowAggregates = new Map<string, TableAggregate>([
  ["avg", "avg"],
  ["count", "count"],
  ["max", "max"],
  ["min", "min"],
  ["sum", "sum"],
]);

const identifierRune = /^[\p{L}\p{Nd}_$ ]$/u;

/** A recursive-descent reader over one select list or filter column, by code point. */
class RowSelectParser {
  private readonly input: string[];
  private position = 0;
  private depth = 0;

  constructor(
    private readonly text: string,
    private readonly what: string,
  ) {
    this.input = Array.from(text);
  }

  atEnd(): boolean {
    return this.position >= this.input.length;
  }

  private peek(): string {
    return this.atEnd() ? "" : this.input[this.position];
  }

  private hasPrefix(prefix: string): boolean {
    return this.prefixEnd(prefix) >= 0;
  }

  consume(prefix: string): boolean {
    const end = this.prefixEnd(prefix);
    if (end >= 0) this.position = end;
    return end >= 0;
  }

  private prefixEnd(prefix: string): number {
    let position = this.position;
    for (const char of Array.from(prefix)) {
      if (position >= this.input.length || this.input[position] !== char) return -1;
      position++;
    }
    return position;
  }

  private skipSpace(): void {
    while (this.peek() === " " || this.peek() === "\t") this.position++;
  }

  fail(reason: string): RowsRefusal {
    const found = this.atEnd() ? "end of input" : `'${this.peek()}'`;
    return invalidRowsRequest(
      `the ${this.what} ${JSON.stringify(this.text)} has an unexpected ${found} at position ${this.position + 1}, ${reason}`,
    );
  }

  /**
   * A double-quoted name, in which a backslash escapes the next character, or an unquoted name of
   * letters, digits, '_', '$' and spaces with single dashes between its parts.
   */
  fieldName(): string {
    if (this.peek() === '"') return this.quoted();
    const parts: string[] = [];
    for (;;) {
      const start = this.position;
      while (!this.atEnd() && identifierRune.test(this.peek())) this.position++;
      const part = this.input.slice(start, this.position).join("").trim();
      if (part === "") throw this.fail("expecting a name");
      parts.push(part);
      if (!this.hasPrefix("-") || this.hasPrefix("->")) return parts.join("-");
      this.position++;
    }
  }

  private quoted(): string {
    this.position++;
    let value = "";
    while (!this.atEnd()) {
      const char = this.peek();
      this.position++;
      if (char === '"') return value;
      if (char === "\\") {
        if (this.atEnd()) throw this.fail("expecting a character after '\\'");
        value += this.peek();
        this.position++;
      } else {
        value += char;
      }
    }
    throw this.fail("expecting a closing '\"'");
  }

  /** Items separated by commas, up to a ')' or the end. */
  selectList(): TableSelectItem[] {
    const items: TableSelectItem[] = [];
    this.skipSpace();
    if (this.atEnd() || this.peek() === ")") return items;
    for (;;) {
      items.push(this.selectItem());
      this.skipSpace();
      if (!this.consume(",")) return items;
      this.skipSpace();
    }
  }

  private selectItem(): TableSelectItem {
    if (this.hasPrefix("..."))
      throw invalidRowsRequest("spreading an embedded table is not supported");
    if (this.consume("*")) {
      if (!this.atItemEnd()) throw this.fail("expecting ',', ')' or end of input");
      return { star: true };
    }
    const start = this.position;
    const aggregate = this.aggregate();
    if (aggregate !== undefined) return aggregate;
    this.position = start;
    const embed = this.embed();
    if (embed !== undefined) return { embed };
    this.position = start;
    return this.columnItem();
  }

  /**
   * [alias:]column.function() or [alias:]count(), or undefined when the input is neither, and the
   * caller reads an embed or a column from the same position. An empty embed of a relation named
   * count reads as the aggregate, as it does in PostgREST.
   */
  private aggregate(): TableSelectItem | undefined {
    const alias = this.alias();
    const quoted = this.peek() === '"';
    if (!quoted && !identifierRune.test(this.peek())) return undefined;
    const name = this.fieldName();
    const item: TableSelectItem = { alias };
    if (!quoted && name === "count" && this.consume("()")) {
      item.aggregate = "count";
    } else if (this.consume(".")) {
      const quotedFunction = this.peek() === '"';
      const aggregate = rowAggregates.get(this.fieldName());
      if (quotedFunction || aggregate === undefined || !this.consume("()")) {
        throw invalidRowsRequest(
          "only the aggregates avg(), count(), max(), min() and sum() are supported",
        );
      }
      item.column = name;
      item.aggregate = aggregate;
    } else {
      return undefined;
    }
    if (this.hasPrefix("::")) throw invalidRowsRequest("casts are not supported");
    if (!this.atItemEnd()) throw this.fail("expecting ',', ')' or end of input");
    return item;
  }

  private atItemEnd(): boolean {
    this.skipSpace();
    return this.atEnd() || this.peek() === "," || this.peek() === ")";
  }

  /** "alias:" when the input starts with one; otherwise the position stays where it was. */
  private alias(): string {
    const start = this.position;
    try {
      const name = this.fieldName();
      if (this.hasPrefix(":") && !this.hasPrefix("::")) {
        this.position++;
        return name;
      }
    } catch (error) {
      if (!(error instanceof RowsRefusal)) throw error;
    }
    this.position = start;
    return "";
  }

  /**
   * [alias:]relation[!hint][!inner|!left](select), or undefined when the input is not an embed,
   * and the caller reads a column from the same position.
   */
  private embed(): TableEmbed | undefined {
    const alias = this.alias();
    if (this.peek() !== '"' && !identifierRune.test(this.peek())) return undefined;
    const relation = this.fieldName();
    const embed: TableEmbed = { relation, alias, hint: "", inner: false, select: [] };
    let hinted = false;
    let joined = false;
    while (this.consume("!")) {
      const parameter = this.fieldName();
      if ((parameter === "inner" || parameter === "left") && !joined) {
        embed.inner = parameter === "inner";
        joined = true;
      } else if (parameter !== "inner" && parameter !== "left" && !hinted) {
        embed.hint = parameter;
        hinted = true;
      }
    }
    if (!this.consume("(")) return undefined;
    // The depth is bounded here, so a deeply nested select cannot recurse without bound.
    this.depth++;
    if (this.depth > maxTableEmbedDepth) {
      throw invalidRowsRequest(`embeds nest deeper than ${maxTableEmbedDepth} levels`);
    }
    const items = this.selectList();
    if (!this.consume(")")) throw this.fail("expecting ',' or ')'");
    this.depth--;
    embed.select = items;
    return embed;
  }

  private columnItem(): TableSelectItem {
    const alias = this.alias();
    const column = this.fieldName();
    if (this.hasPrefix("->")) throw invalidRowsRequest("JSON paths are not supported");
    if (this.hasPrefix("::")) throw invalidRowsRequest("casts are not supported");
    if (!this.atItemEnd()) throw this.fail("expecting ',', ')' or end of input");
    return { column, alias };
  }
}
