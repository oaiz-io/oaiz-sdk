import type { Client } from "../client";
import type {
  DtoDeleteStorageDatabaseRowsInput,
  DtoInsertStorageDatabaseRowsInput,
  DtoSelectStorageDatabaseRowsInput,
  DtoStorageDatabaseRows,
  DtoStorageRowCount,
  DtoStorageRowFilter,
  DtoStorageRowFilterOperator,
  DtoStorageRowOrder,
  DtoUpdateStorageDatabaseRowsInput,
  DtoUpsertStorageDatabaseRowsInput,
} from "../models";
import {
  FilterParseError,
  condition,
  likePattern,
  parseLogic,
} from "./filters";
import type {
  FilterOperator,
  FilterValue,
  GenericDatabase,
  InsertOf,
  OrderColumn,
  ResultData,
  ResultShape,
  RowOf,
  SelectFilters,
  SelectOrder,
  SelectQuery,
  WriteSelectQuery,
  SelectRow,
  SelectedShape,
  SingleShape,
  TableName,
  UpdateOf,
} from "./types";
import {
  REQUEST_INVALID_CODE,
  failure,
  failureFrom,
  type OaizResponse,
} from "./response";

type Row = Record<string, unknown>;

type Action = "select" | "insert" | "upsert" | "update" | "delete";

interface CountOption {
  /** `"exact"` also answers, as `count`, the number of rows the request matches or changes. */
  count?: DtoStorageRowCount;
}

/** Options of `select`. */
export interface OaizSelectOptions extends CountOption {}

/** Options of `insert`. */
export interface OaizInsertOptions extends CountOption {
  /**
   * A row that leaves out a column another row of the same call gives stores null in it. False
   * stores the column's default instead. Defaults to true.
   */
  defaultToNull?: boolean;
}

/** Options of `upsert`. */
export interface OaizUpsertOptions extends OaizInsertOptions {
  /** The columns of the unique key that match a row, separated by commas. Defaults to the primary key. */
  onConflict?: string;
  /** Keeps a row that already exists as it is, instead of changing it. */
  ignoreDuplicates?: boolean;
}

/** Options of `update`. */
export interface OaizUpdateOptions extends CountOption {}

/** Options of `delete`. */
export interface OaizDeleteOptions extends CountOption {}

/** Options of `order`. */
export interface OaizOrderOptions {
  /** Sorts from low to high. Defaults to true. */
  ascending?: boolean;
  /** Puts nulls first. By default nulls come last from low to high, and first from high to low. */
  nullsFirst?: boolean;
}

interface Request {
  action: Action;
  table: string;
  select?: string;
  count?: DtoStorageRowCount;
  rows?: Row[];
  values?: Row;
  defaultToNull?: boolean;
  onConflict?: string[];
  ignoreDuplicates?: boolean;
}

/** A delete's arguments: none or its options on a table, and none that type-check on a view. */
type DeleteArgs<Database extends GenericDatabase, Table extends string> =
  Table extends TableName<Database> ? [options?: OaizDeleteOptions] : [view: never];

/** Starts a request on one table or view of one database. A view only reads. */
export class OaizQueryBuilder<
  Database extends GenericDatabase = any,
  Table extends string = string,
> {
  /** @internal */
  constructor(
    private readonly client: Client,
    private readonly database: string,
    private readonly table: string,
  ) {}

  /**
   * Reads rows with these columns, `*` for all of them. A related table is named with its
   * columns, as `companies(name)`.
   */
  select<Query extends string = "*">(
    columns?: SelectQuery<Database, Table, Query>,
    options: OaizSelectOptions = {},
  ): OaizFilterBuilder<
    Database,
    Table,
    SelectFilters<Database, Table, Query>,
    SelectRow<Database, Table, Query>,
    "rows",
    SelectOrder<Database, Table, Query>
  > {
    return this.builder({
      action: "select",
      table: this.table,
      select: compactSelect(columns ?? "*"),
      count: options.count,
    });
  }

  /** Inserts one row or a list of rows. Add `.select()` to answer the inserted rows. */
  insert(
    values: InsertOf<Database, Table> | InsertOf<Database, Table>[],
    options: OaizInsertOptions = {},
  ): OaizWriteBuilder<Database, Table> {
    return this.builder({
      action: "insert",
      table: this.table,
      rows: Array.isArray(values) ? values : [values],
      count: options.count,
      defaultToNull: options.defaultToNull,
    });
  }

  /**
   * Inserts one row or a list of rows, and changes the existing row instead where a row matches
   * one on the primary key or `onConflict`. Add `.select()` to answer the written rows.
   */
  upsert(
    values: InsertOf<Database, Table> | InsertOf<Database, Table>[],
    options: OaizUpsertOptions = {},
  ): OaizWriteBuilder<Database, Table> {
    return this.builder({
      action: "upsert",
      table: this.table,
      rows: Array.isArray(values) ? values : [values],
      count: options.count,
      defaultToNull: options.defaultToNull,
      onConflict:
        options.onConflict === undefined
          ? undefined
          : options.onConflict.split(",").map((column) => column.trim()),
      ignoreDuplicates: options.ignoreDuplicates,
    });
  }

  /** Changes these columns of the rows the filters match. It needs at least one filter. */
  update(
    values: UpdateOf<Database, Table>,
    options: OaizUpdateOptions = {},
  ): OaizFilteredWriteBuilder<Database, Table> {
    return this.builder({
      action: "update",
      table: this.table,
      values,
      count: options.count,
    });
  }

  /** Removes the rows the filters match. It needs at least one filter. */
  delete(...args: DeleteArgs<Database, Table>): OaizFilteredWriteBuilder<Database, Table> {
    const [options = {}] = args;
    return this.builder({
      action: "delete",
      table: this.table,
      count: options.count,
    });
  }

  private builder(request: Request): OaizFilterBuilder<any, any, any, any, any> {
    return new OaizFilterBuilder(this.client, this.database, request);
  }
}

/** Filters on the columns in `Filterable`; each adds one condition and answers the same builder. */
export interface OaizFilters<Filterable extends Record<string, unknown>> {
  /** Only the rows whose `column` equals `value`. */
  eq<Column extends keyof Filterable & string>(column: Column, value: FilterValue<Filterable[Column]>): this;
  /** Only the rows whose `column` does not equal `value`. */
  neq<Column extends keyof Filterable & string>(column: Column, value: FilterValue<Filterable[Column]>): this;
  /** Only the rows whose `column` is greater than `value`. */
  gt<Column extends keyof Filterable & string>(column: Column, value: FilterValue<Filterable[Column]>): this;
  /** Only the rows whose `column` is greater than or equal to `value`. */
  gte<Column extends keyof Filterable & string>(column: Column, value: FilterValue<Filterable[Column]>): this;
  /** Only the rows whose `column` is less than `value`. */
  lt<Column extends keyof Filterable & string>(column: Column, value: FilterValue<Filterable[Column]>): this;
  /** Only the rows whose `column` is less than or equal to `value`. */
  lte<Column extends keyof Filterable & string>(column: Column, value: FilterValue<Filterable[Column]>): this;
  /** Only the rows whose `column` matches `pattern`, in which `%` or `*` stands for any text. */
  like(column: keyof Filterable & string, pattern: string): this;
  /** As `like`, ignoring upper and lower case. */
  ilike(column: keyof Filterable & string, pattern: string): this;
  /** Only the rows whose `column` equals one of `values`. */
  in<Column extends keyof Filterable & string>(
    column: Column,
    values: readonly FilterValue<Filterable[Column]>[],
  ): this;
  /** Only the rows whose `column` is `value`: null, true or false. */
  is(column: keyof Filterable & string, value: null | boolean): this;
  /** Negates one condition; an `in` value is written as `(a,b)`. */
  not(column: keyof Filterable & string, operator: FilterOperator, value: unknown): this;
  /** Adds one group that matches when any member does, from a string such as `a.eq.1,b.is.null`. */
  or(filters: string): this;
}

/**
 * An insert or upsert. The OAIZ server's request for it carries no filters, order or range, so the builder
 * offers none; it answers no rows until `.select()`.
 */
export interface OaizWriteBuilder<
  Database extends GenericDatabase = any,
  Table extends string = string,
  Selected = RowOf<Database, Table>,
  Shape extends ResultShape = "none",
> extends PromiseLike<OaizResponse<ResultData<Selected, Shape>>> {
  /** Requires exactly one written row and answers that row once `.select()` names columns. */
  single(): OaizWriteBuilder<Database, Table, Selected, SingleShape<Shape>>;
  /** Answers the written rows with these columns. */
  select<Query extends string = "*">(
    columns?: WriteSelectQuery<Database, Table, Query>,
  ): OaizWriteBuilder<Database, Table, SelectRow<Database, Table, Query>, SelectedShape<Shape>>;
}

/**
 * An update or delete. It filters on the table's own columns; the OAIZ server's request for it carries no
 * order or range, so the builder offers none. It answers no rows until `.select()`.
 */
export interface OaizFilteredWriteBuilder<
  Database extends GenericDatabase = any,
  Table extends string = string,
  Selected = RowOf<Database, Table>,
  Shape extends ResultShape = "none",
> extends OaizFilters<RowOf<Database, Table>>,
    PromiseLike<OaizResponse<ResultData<Selected, Shape>>> {
  /** Requires exactly one written row and answers that row once `.select()` names columns. */
  single(): OaizFilteredWriteBuilder<Database, Table, Selected, SingleShape<Shape>>;
  /** Answers the written rows with these columns. */
  select<Query extends string = "*">(
    columns?: WriteSelectQuery<Database, Table, Query>,
  ): OaizFilteredWriteBuilder<Database, Table, SelectRow<Database, Table, Query>, SelectedShape<Shape>>;
}

/**
 * Narrows and shapes one request. Every `await` sends the request once and resolves to an
 * `OaizResponse`; nothing is sent before that. Filters and transforms add to this builder;
 * `single` and `select` change the result type, so they answer a copy and leave this one as is.
 */
export class OaizFilterBuilder<
  Database extends GenericDatabase = any,
  Table extends string = string,
  Filterable extends Record<string, unknown> = Record<string, any>,
  Selected = any,
  Shape extends ResultShape = "rows",
  Ordered extends string = OrderColumn<Database, Table>,
> implements OaizFilters<Filterable>, PromiseLike<OaizResponse<ResultData<Selected, Shape>>>
{
  private readonly filters: DtoStorageRowFilter[] = [];
  private readonly orderTerms: DtoStorageRowOrder[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private singleValue = false;
  private invalid?: string;

  /** @internal */
  constructor(
    private readonly client: Client,
    private readonly database: string,
    private readonly request: Request,
  ) {}

  eq<Column extends keyof Filterable & string>(
    column: Column,
    value: FilterValue<Filterable[Column]>,
  ): this {
    return this.compare(column, "eq", value);
  }

  neq<Column extends keyof Filterable & string>(
    column: Column,
    value: FilterValue<Filterable[Column]>,
  ): this {
    return this.compare(column, "neq", value);
  }

  gt<Column extends keyof Filterable & string>(
    column: Column,
    value: FilterValue<Filterable[Column]>,
  ): this {
    return this.compare(column, "gt", value);
  }

  gte<Column extends keyof Filterable & string>(
    column: Column,
    value: FilterValue<Filterable[Column]>,
  ): this {
    return this.compare(column, "gte", value);
  }

  lt<Column extends keyof Filterable & string>(
    column: Column,
    value: FilterValue<Filterable[Column]>,
  ): this {
    return this.compare(column, "lt", value);
  }

  lte<Column extends keyof Filterable & string>(
    column: Column,
    value: FilterValue<Filterable[Column]>,
  ): this {
    return this.compare(column, "lte", value);
  }

  like(column: keyof Filterable & string, pattern: string): this {
    return this.compare(column, "like", likePattern(pattern));
  }

  ilike(column: keyof Filterable & string, pattern: string): this {
    return this.compare(column, "ilike", likePattern(pattern));
  }

  in<Column extends keyof Filterable & string>(
    column: Column,
    values: readonly FilterValue<Filterable[Column]>[],
  ): this {
    this.filters.push({ column, operator: "in", values: values.map(filterText) });
    return this;
  }

  is(column: keyof Filterable & string, value: null | boolean): this {
    return this.compare(column, "is", value);
  }

  /** Negates one condition; an `in` value is written as `(a,b)`. */
  not(column: keyof Filterable & string, operator: FilterOperator, value: unknown): this {
    return this.parse(() => [condition(column, operator, filterText(value), true)]);
  }

  /** Adds one group that matches when any member does, from a string such as `a.eq.1,b.is.null`. */
  or(filters: string): this {
    return this.parse(() => [{ or: parseLogic(filters) }]);
  }

  /** Sorts the rows by `column`; each call adds one column to sort by after the earlier ones. */
  order(column: Ordered, options: OaizOrderOptions = {}): this {
    const term: DtoStorageRowOrder = { column };
    if (options.ascending !== undefined) {
      term.ascending = options.ascending;
    }
    if (options.nullsFirst !== undefined) {
      term.nullsFirst = options.nullsFirst;
    }
    this.orderTerms.push(term);
    return this;
  }

  /** At most `count` rows, a whole number from 0. */
  limit(count: number): this {
    if (!isRowNumber(count)) {
      return this.refuse(`limit takes a whole number of rows from 0, not ${count}`);
    }
    this.limitValue = count;
    return this;
  }

  /** Rows `from` to `to`, both counted from 0 and included, so `to` is at least `from`. */
  range(from: number, to: number): this {
    if (!isRowNumber(from) || !isRowNumber(to) || to < from) {
      return this.refuse(`range takes whole row numbers from 0 with from <= to, not ${from} to ${to}`);
    }
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  /** Requires exactly one row and answers that row instead of a list. */
  single(): OaizFilterBuilder<
    Database,
    Table,
    Filterable,
    Selected,
    SingleShape<Shape>,
    Ordered
  > {
    const next = this.copy();
    next.singleValue = true;
    return next;
  }

  /** Answers the written rows with these columns; a write without it answers `data: null`. */
  select<Query extends string = "*">(
    columns?: WriteSelectQuery<Database, Table, Query>,
  ): OaizFilterBuilder<
    Database,
    Table,
    Filterable,
    SelectRow<Database, Table, Query>,
    SelectedShape<Shape>,
    Ordered
  > {
    const next = this.copy();
    next.request.select = compactSelect(columns ?? "*");
    return next;
  }

  private copy(): OaizFilterBuilder<any, any, any, any, any> {
    const next = new OaizFilterBuilder(this.client, this.database, { ...this.request });
    next.filters.push(...this.filters);
    next.orderTerms.push(...this.orderTerms);
    next.limitValue = this.limitValue;
    next.offsetValue = this.offsetValue;
    next.singleValue = this.singleValue;
    next.invalid = this.invalid;
    return next;
  }

  then<TResult1 = OaizResponse<ResultData<Selected, Shape>>, TResult2 = never>(
    onfulfilled?:
      | ((
          value: OaizResponse<ResultData<Selected, Shape>>,
        ) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return (
      this.execute() as Promise<OaizResponse<ResultData<Selected, Shape>>>
    ).then(onfulfilled, onrejected);
  }

  private compare(
    column: string,
    operator: DtoStorageRowFilterOperator,
    value: unknown,
  ): this {
    this.filters.push({ column, operator, value: filterText(value) });
    return this;
  }

  private parse(build: () => DtoStorageRowFilter[]): this {
    try {
      this.filters.push(...build());
    } catch (error) {
      if (!(error instanceof FilterParseError)) {
        throw error;
      }
      this.refuse(error.message);
    }
    return this;
  }

  /** Keeps the first reason the request cannot be sent; `execute` answers it without sending. */
  private refuse(reason: string): this {
    this.invalid = this.invalid ?? reason;
    return this;
  }

  /** Why the OAIZ server's request for this action cannot carry what the builder holds, if it cannot. */
  private unsendable(): string | undefined {
    const { action } = this.request;
    if (action === "select") {
      return undefined;
    }
    if (
      this.orderTerms.length > 0 ||
      this.limitValue !== undefined ||
      this.offsetValue !== undefined
    ) {
      return `${action} takes no order, limit or range`;
    }
    if ((action === "insert" || action === "upsert") && this.filters.length > 0) {
      return `${action} takes no filters`;
    }
    return undefined;
  }

  private async execute(): Promise<OaizResponse<any>> {
    const invalid = this.invalid ?? this.unsendable();
    if (invalid !== undefined) {
      return failure(400, {
        message: invalid,
        code: REQUEST_INVALID_CODE,
        hints: [],
      });
    }
    let answer: DtoStorageDatabaseRows;
    try {
      answer = await this.send();
    } catch (error) {
      return failureFrom(error);
    }
    const rows = answer.rows ?? [];
    const returnsRows =
      this.request.action === "select" || this.request.select !== undefined;
    let data: unknown = null;
    if (returnsRows) {
      data = this.singleValue ? (rows[0] ?? null) : rows;
    }
    return { data, error: null, count: answer.count ?? null, status: 200 };
  }

  private send(): Promise<DtoStorageDatabaseRows> {
    const { action, table, select, count } = this.request;
    const shared = {
      table,
      ...(select === undefined ? {} : { select }),
      ...(count === undefined ? {} : { count }),
      ...(this.singleValue ? { single: true } : {}),
    };
    switch (action) {
      case "select": {
        const body: DtoSelectStorageDatabaseRowsInput = { ...shared };
        if (this.filters.length > 0) {
          body.filters = this.filters;
        }
        if (this.orderTerms.length > 0) {
          body.order = this.orderTerms;
        }
        if (this.limitValue !== undefined) {
          body.limit = this.limitValue;
        }
        if (this.offsetValue !== undefined) {
          body.offset = this.offsetValue;
        }
        return this.client.selectStorageDatabaseRows(this.database, body);
      }
      case "insert": {
        const body: DtoInsertStorageDatabaseRowsInput = {
          ...shared,
          rows: this.request.rows ?? [],
        };
        if (this.request.defaultToNull !== undefined) {
          body.defaultToNull = this.request.defaultToNull;
        }
        return this.client.insertStorageDatabaseRows(this.database, body);
      }
      case "upsert": {
        const body: DtoUpsertStorageDatabaseRowsInput = {
          ...shared,
          rows: this.request.rows ?? [],
        };
        if (this.request.defaultToNull !== undefined) {
          body.defaultToNull = this.request.defaultToNull;
        }
        if (this.request.onConflict !== undefined) {
          body.onConflict = this.request.onConflict;
        }
        if (this.request.ignoreDuplicates !== undefined) {
          body.ignoreDuplicates = this.request.ignoreDuplicates;
        }
        return this.client.upsertStorageDatabaseRows(this.database, body);
      }
      case "update": {
        const body: DtoUpdateStorageDatabaseRowsInput = {
          ...shared,
          values: this.request.values ?? {},
          filters: this.filters,
        };
        return this.client.updateStorageDatabaseRows(this.database, body);
      }
      case "delete": {
        const body: DtoDeleteStorageDatabaseRowsInput = {
          ...shared,
          filters: this.filters,
        };
        return this.client.deleteStorageDatabaseRows(this.database, body);
      }
    }
  }
}

/** Removes whitespace outside double-quoted names, in which a backslash escapes the next character. */
function compactSelect(columns: string): string {
  let quoted = false;
  let escaped = false;
  let compact = "";
  for (const char of columns) {
    if (escaped) {
      escaped = false;
    } else if (quoted && char === "\\") {
      escaped = true;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && /\s/.test(char)) {
      continue;
    }
    compact += char;
  }
  return compact;
}

/** A filter operand as text: a `Json` object or array as JSON, anything else as `String` writes it. */
function filterText(value: unknown): string {
  return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}

function isRowNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
