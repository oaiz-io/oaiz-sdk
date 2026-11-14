/** One foreign key a table holds, as `oaiz db types` writes it. */
export type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

/** One table: the row it reads, what an insert and an update take, and its foreign keys. */
export type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: GenericRelationship[];
};

/** One view: the row it reads. A view takes no writes and holds no foreign keys. */
export type GenericView = {
  Row: Record<string, unknown>;
};

/** One function: the arguments it takes by name and what it returns. */
export type GenericFunction = {
  Args: Record<string, unknown>;
  Returns: unknown;
};

/** The `Database` type `oaiz db types` writes. */
export type GenericDatabase = {
  data: {
    Tables: Record<string, GenericTable>;
    Views?: Record<string, GenericView>;
    Functions?: Record<string, GenericFunction>;
  };
};

/** The operators `not` takes. */
export type FilterOperator =
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

/**
 * What a request answers as `data`: nothing, one row, or a list of rows. `single` is a write
 * that answers nothing until `.select()` names columns, and then one row.
 */
export type ResultShape = "none" | "single" | "one" | "rows";

export type ResultData<Selected, Shape extends ResultShape> = Shape extends "none" | "single"
  ? null
  : Shape extends "one"
    ? Selected
    : Selected[];

/** The shape after `.single()`. */
export type SingleShape<Shape extends ResultShape> = Shape extends "none" | "single" ? "single" : "one";

/** The shape after `.select()`. */
export type SelectedShape<Shape extends ResultShape> = Shape extends "single" | "one" ? "one" : "rows";

export type IsAny<T> = 0 extends 1 & T ? true : false;

type UntypedRow = Record<string, any>;

type Tables<Database extends GenericDatabase> = Database["data"]["Tables"];

type Views<Database extends GenericDatabase> = Database["data"] extends {
  Views: infer V extends Record<string, GenericView>;
}
  ? V
  : {};

type Functions<Database extends GenericDatabase> = Database["data"] extends {
  Functions: infer F extends Record<string, GenericFunction>;
}
  ? F
  : {};

/** Table names a write accepts; any string without a `Database` type. */
export type TableName<Database extends GenericDatabase> =
  IsAny<Database> extends true ? string : keyof Tables<Database> & string;

/** Table and view names a read accepts; any string without a `Database` type. */
export type RelationName<Database extends GenericDatabase> =
  IsAny<Database> extends true ? string : (keyof Tables<Database> | keyof Views<Database>) & string;

type TableOf<Database extends GenericDatabase, Name extends string> =
  Name extends keyof Tables<Database> ? Tables<Database>[Name] : never;

type ViewRow<View> = View extends { Row: infer Row extends Record<string, unknown> } ? Row : never;

/** A table, or a view read as a table that holds no foreign keys. */
type RelationOf<Database extends GenericDatabase, Name extends string> =
  Name extends keyof Tables<Database>
    ? Tables<Database>[Name]
    : Name extends keyof Views<Database>
      ? { Row: ViewRow<Views<Database>[Name]>; Relationships: [] }
      : never;

export type RowOf<Database extends GenericDatabase, Name extends string> =
  IsAny<Database> extends true ? UntypedRow : RelationOf<Database, Name>["Row"];

export type InsertOf<Database extends GenericDatabase, Name extends string> =
  IsAny<Database> extends true ? UntypedRow : TableOf<Database, Name>["Insert"];

export type UpdateOf<Database extends GenericDatabase, Name extends string> =
  IsAny<Database> extends true ? UntypedRow : TableOf<Database, Name>["Update"];

/** The names of the functions a database holds; any string without a `Database` type. */
export type FunctionName<Database extends GenericDatabase> =
  IsAny<Database> extends true ? string : keyof Functions<Database> & string;

/** The named arguments a function takes. */
export type FunctionArgs<Database extends GenericDatabase, Name extends string> =
  IsAny<Database> extends true
    ? UntypedRow
    : Name extends keyof Functions<Database>
      ? Functions<Database>[Name] extends { Args: infer Args } ? Args : never
      : never;

/** What a function returns: a value, a row, a list of either, or null for void. */
export type FunctionReturns<Database extends GenericDatabase, Name extends string> =
  IsAny<Database> extends true
    ? any
    : Name extends keyof Functions<Database>
      ? Functions<Database>[Name] extends { Returns: infer Returns } ? Returns : never
      : never;

/** The arguments `rpc` takes after the name: optional when every argument has a default. */
export type RpcArgs<Database extends GenericDatabase, Name extends string> =
  {} extends FunctionArgs<Database, Name>
    ? [args?: FunctionArgs<Database, Name>]
    : [args: FunctionArgs<Database, Name>];

/**
 * The value a comparison takes for a column. The OAIZ server binds it as text for Postgres to read as the
 * column type, so a Postgres array column takes its array literal, such as `{a,b}`; a `Json`
 * column takes objects and arrays, which the client sends as JSON text.
 */
export type FilterValue<T> =
  IsAny<T> extends true ? any : [NonNullable<T>] extends [readonly unknown[]] ? string : NonNullable<T>;

/** Column names `order` takes: the table's own columns. */
export type OrderColumn<Database extends GenericDatabase, Name extends string> =
  keyof RowOf<Database, Name> & string;

type Prettify<T> = { [K in keyof T]: T[K] } & {};

// ---------------------------------------------------------------------------
// Select string parser. It reads the grammar the OAIZ server reads after the client
// removes whitespace outside double quotes.

type ParseError<Message extends string> = { error: Message };

type StarNode = { kind: "star" };
type ColumnNode<Name extends string, Key extends string> = {
  kind: "column";
  name: Name;
  key: Key;
};
type EmbedNode<
  Name extends string,
  Key extends string,
  Hint extends string | null,
  Inner extends boolean,
  Items extends SelectNode[],
> = { kind: "embed"; name: Name; key: Key; hint: Hint; inner: Inner; items: Items };
type AggregateName = "avg" | "count" | "max" | "min" | "sum";
/** Column is null for a count of rows. Key is the alias, or the function's name. */
type AggregateNode<
  Function extends AggregateName,
  Column extends string | null,
  Key extends string,
> = { kind: "aggregate"; function: Function; column: Column; key: Key };
type SelectNode =
  | StarNode
  | ColumnNode<string, string>
  | AggregateNode<AggregateName, string | null, string>
  | EmbedNode<string, string, string | null, boolean, any[]>;

type Whitespace = " " | "\n" | "\r" | "\t";

type Compact<
  S extends string,
  Acc extends string = "",
  Quoted extends boolean = false,
> = S extends `${infer C}${infer Rest}`
  ? [Quoted, C] extends [true, "\\"]
    ? Rest extends `${infer Escaped}${infer After}`
      ? Compact<After, `${Acc}${C}${Escaped}`, true>
      : `${Acc}${C}`
    : C extends '"'
      ? Compact<Rest, `${Acc}${C}`, Quoted extends true ? false : true>
      : Quoted extends false
        ? C extends Whitespace
          ? Compact<Rest, Acc, false>
          : Compact<Rest, `${Acc}${C}`, false>
        : Compact<Rest, `${Acc}${C}`, true>
  : Acc;

type CompactSelect<S extends string> = S extends `${string}${Whitespace}${string}`
  ? Compact<S>
  : S;

type Delimiter = "," | "(" | ")" | "!" | ":" | '"';

type ReadPlain<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
  ? C extends Delimiter
    ? [Acc, S]
    : ReadPlain<Rest, `${Acc}${C}`>
  : [Acc, ""];

type ReadQuoted<S extends string, Acc extends string = ""> = S extends `\\${infer C}${infer Rest}`
  ? ReadQuoted<Rest, `${Acc}${C}`>
  : S extends `"${infer Rest}`
    ? [Acc, Rest]
    : S extends `${infer C}${infer Rest}`
      ? ReadQuoted<Rest, `${Acc}${C}`>
      : ParseError<"the select has a quoted name without its closing quote">;

/** A double-quoted name with backslash escapes, or plain text up to the next delimiter. */
type ReadName<S extends string> = S extends `"${infer Rest}`
  ? ReadQuoted<Rest>
  : ReadPlain<S> extends [infer Name extends string, infer Rest extends string]
    ? Name extends ""
      ? ParseError<`the select expects a name at "${S}"`>
      : Name extends `${string}->${string}`
        ? ParseError<"JSON paths are not supported">
        : Name extends `${infer Column}.${infer After}`
          ? Column extends ""
            ? ParseError<`the select expects a name at "${S}"`>
            : [Column, `.${After}${Rest}`]
          : [Name, Rest]
    : never;

type AtItemEnd<S extends string> = S extends "" | `,${string}` | `)${string}` ? true : false;

type ParseItem<S extends string> = S extends `...${string}`
  ? ParseError<"spreading an embedded table is not supported">
  : S extends `*${infer Rest}`
  ? AtItemEnd<Rest> extends true
    ? [StarNode, Rest]
    : ParseError<`the select expects ',' or ')' after '*' at "${Rest}"`>
  : ReadName<S> extends infer First
    ? First extends [infer Name extends string, infer Rest extends string]
      ? Rest extends `::${string}`
        ? ParseError<"casts are not supported">
        : Rest extends `:${infer AfterAlias}`
          ? ReadName<AfterAlias> extends infer Second
            ? Second extends [infer Target extends string, infer Tail extends string]
              ? ParseNamed<Target, Name, Tail, AfterAlias extends `"${string}` ? true : false>
              : Second
            : never
          : ParseNamed<Name, null, Rest, S extends `"${string}` ? true : false>
      : First
    : never;

/**
 * Reads what follows a name: `.function()` or an unquoted `count()` make an aggregate, and Key is
 * its alias. A quoted `"count"()` is an embed, as on the OAIZ server.
 */
type ParseNamed<
  Name extends string,
  Key extends string | null,
  S extends string,
  Quoted extends boolean,
> = S extends `.${infer After}`
  ? ParseAggregate<Name, Key, After>
  : [Name, Quoted] extends ["count", false]
    ? S extends `()${string}`
      ? ParseAggregate<null, Key, `count${S}`>
      : ParseTail<Name, Key extends string ? Key : Name, S>
    : ParseTail<Name, Key extends string ? Key : Name, S>;

type ParseAggregate<
  Column extends string | null,
  Key extends string | null,
  S extends string,
> = S extends `${infer Function extends AggregateName}()${infer Rest}`
  ? Rest extends `::${string}`
    ? ParseError<"casts are not supported">
    : AtItemEnd<Rest> extends true
      ? [AggregateNode<Function, Column, Key extends string ? Key : Function>, Rest]
      : ParseError<`the select expects ',' or ')' after "${Function}()" at "${Rest}"`>
  : ParseError<"only the aggregates avg(), count(), max(), min() and sum() are supported">;

/** Reads `[!hint][!inner|!left](…)` after a name, or ends a column. The first hint and join win. */
type ParseTail<
  Name extends string,
  Key extends string,
  S extends string,
  Hint extends string | null = null,
  Join extends "inner" | "left" | null = null,
  Bang extends boolean = false,
> = S extends `!${infer AfterBang}`
  ? ReadName<AfterBang> extends infer Parameter
    ? Parameter extends [infer Value extends string, infer Rest extends string]
      ? Value extends "inner" | "left"
        ? ParseTail<Name, Key, Rest, Hint, Join extends null ? Value : Join, true>
        : ParseTail<Name, Key, Rest, Hint extends null ? Value : Hint, Join, true>
      : Parameter
    : never
  : S extends `(${infer Body}`
    ? ParseEmbedBody<Name, Key, Hint, Join extends "inner" ? true : false, Body>
    : Bang extends true
      ? ParseError<`the embed "${Name}" expects '(' at "${S}"`>
      : AtItemEnd<S> extends true
        ? [ColumnNode<Name, Key>, S]
        : ParseError<`the select expects ',' or ')' after "${Name}" at "${S}"`>;

type ParseEmbedBody<
  Name extends string,
  Key extends string,
  Hint extends string | null,
  Inner extends boolean,
  S extends string,
> = S extends `)${infer Rest}`
  ? [EmbedNode<Name, Key, Hint, Inner, []>, Rest]
  : ParseList<S> extends infer Parsed
    ? Parsed extends [infer Items extends SelectNode[], infer Rest extends string]
      ? Rest extends `)${infer After}`
        ? [EmbedNode<Name, Key, Hint, Inner, Items>, After]
        : ParseError<`the embed "${Name}" expects ')' at "${Rest}"`>
      : Parsed
    : never;

type ParseList<S extends string, Items extends SelectNode[] = []> =
  ParseItem<S> extends infer Parsed
    ? Parsed extends [infer Item extends SelectNode, infer Rest extends string]
      ? Rest extends `,${infer Next}`
        ? ParseList<Next, [...Items, Item]>
        : [[...Items, Item], Rest]
      : Parsed
    : never;

/** Whether an embed sits below `MaxTableEmbedDepth` (3) other embeds, which the OAIZ server refuses. */
type TooDeep<Items extends SelectNode[], Enclosing extends unknown[] = []> = Items extends [
  infer Head extends SelectNode,
  ...infer Tail extends SelectNode[],
]
  ? Head extends EmbedNode<string, string, string | null, boolean, infer Nested extends SelectNode[]>
    ? Enclosing["length"] extends 3
      ? true
      : TooDeep<Nested, [...Enclosing, unknown]> extends true
        ? true
        : TooDeep<Tail, Enclosing>
    : TooDeep<Tail, Enclosing>
  : false;

type ParseSelect<S extends string> = S extends ""
  ? [StarNode]
  : ParseList<S> extends infer Parsed
    ? Parsed extends [infer Items extends SelectNode[], infer Rest extends string]
      ? Rest extends ""
        ? TooDeep<Items> extends true
          ? ParseError<"embeds nest deeper than 3 levels">
          : Items
        : ParseError<`the select has an unexpected "${Rest}"`>
      : Parsed
    : never;

// ---------------------------------------------------------------------------
// Relationships, matched by the rules the OAIZ server applies to an embed.

type Relationship = {
  direction: "forward" | "reverse";
  table: string;
  constraint: string;
  oneToOne: boolean;
  columns: string[];
  foreignColumns: string[];
};

/** Foreign keys the origin holds. */
type ForwardRelationships<Database extends GenericDatabase, Origin extends string> =
  RelationOf<Database, Origin>["Relationships"][number] extends infer R
    ? R extends GenericRelationship
      ? {
          direction: "forward";
          table: R["referencedRelation"];
          constraint: R["foreignKeyName"];
          oneToOne: R["isOneToOne"];
          columns: R["columns"];
          foreignColumns: R["referencedColumns"];
        }
      : never
    : never;

/** Foreign keys other tables hold onto the origin. */
type ReverseRelationships<Database extends GenericDatabase, Origin extends string> = {
  [Holder in keyof Tables<Database> & string]: Tables<Database>[Holder]["Relationships"][number] extends infer R
    ? R extends GenericRelationship & { referencedRelation: Origin }
      ? {
          direction: "reverse";
          table: Holder;
          constraint: R["foreignKeyName"];
          oneToOne: R["isOneToOne"];
          columns: R["referencedColumns"];
          foreignColumns: R["columns"];
        }
      : never
    : never;
}[keyof Tables<Database> & string];

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type SingleColumn<Columns, Name extends string> = Columns extends [infer Only]
  ? Same<Only, Name>
  : false;

type Matches<
  R extends Relationship,
  Origin extends string,
  Target extends string,
  Hint extends string | null,
> = Same<R["table"], Origin> extends true
  ? MatchesSelf<R, Target, Hint>
  : Hint extends string
    ? Same<R["table"], Target> extends true
      ? true extends
          | Same<R["constraint"], Hint>
          | SingleColumn<R["columns"], Hint>
          | SingleColumn<R["foreignColumns"], Hint>
        ? true
        : false
      : false
    : true extends
          | Same<R["table"], Target>
          | Same<R["constraint"], Target>
          | SingleColumn<R["columns"], Target>
      ? true
      : false;

/** A self reference: the table name reaches the children, the column name the parent. */
type MatchesSelf<R extends Relationship, Target extends string, Hint extends string | null> =
  Hint extends string
    ? [Same<R["table"], Target>, R["direction"], R["oneToOne"]] extends [true, "reverse", false]
      ? SingleColumn<R["foreignColumns"], Hint>
      : false
    : [Same<R["table"], Target>, R["direction"], R["oneToOne"]] extends [true, "reverse", false]
      ? true
      : [R["direction"], R["oneToOne"]] extends ["forward", false]
        ? SingleColumn<R["columns"], Target>
        : false;

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : false;

type ResolveRelationship<
  Database extends GenericDatabase,
  Origin extends string,
  Target extends string,
  Hint extends string | null,
> = (ForwardRelationships<Database, Origin> | ReverseRelationships<Database, Origin>) extends infer All
  ? (All extends Relationship ? (Matches<All, Origin, Target, Hint> extends true ? All : never) : never) extends infer Found
    ? [Found] extends [never]
      ? ParseError<`no foreign key relates the tables "${Origin}" and "${Target}"`>
      : IsUnion<Found> extends true
        ? ParseError<`more than one foreign key relates the tables "${Origin}" and "${Target}"; name one with a hint`>
        : Found
    : never
  : never;

// ---------------------------------------------------------------------------
// Evaluation of a parsed select against the Database type.

type Selection = { row: object; filters: object };

/** One select level, refused when two of its items read into one key, which the OAIZ server answers once. */
type EvalLevel<Database extends GenericDatabase, Table extends string, Items extends SelectNode[]> =
  DuplicateKey<Items, keyof RowOf<Database, Table> & string, StarNode extends Items[number] ? true : false> extends infer Clash extends string
    ? [Clash] extends [never]
      ? EvalItems<Database, Table, Items>
      : ParseError<`the select reads more than one value into "${Clash}"`>
    : never;

/** The key an item reads into; an embed without columns reads none. */
type OutputKey<Item extends SelectNode> = Item extends ColumnNode<string, infer Key>
  ? Key
  : Item extends AggregateNode<AggregateName, string | null, infer Key>
    ? Key
  : Item extends EmbedNode<string, infer Key, string | null, boolean, infer Items>
    ? Items extends []
      ? never
      : Key
    : never;

/** The key an item shares with `*`, unless it reads that same column again. */
type StarClash<Item extends SelectNode, Columns extends string> =
  Item extends ColumnNode<infer Name, infer Key>
    ? Same<Name, Key> extends true
      ? never
      : Key & Columns
    : OutputKey<Item> & Columns;

type DuplicateKey<
  Items extends SelectNode[],
  Columns extends string,
  Star extends boolean,
  Seen extends string = never,
> = Items extends [infer Head extends SelectNode, ...infer Tail extends SelectNode[]]
  ? ((OutputKey<Head> & Seen) | (Star extends true ? StarClash<Head, Columns> : never)) extends infer Clash
    ? [Clash] extends [never]
      ? DuplicateKey<Tail, Columns, Star, Seen | OutputKey<Head>>
      : Clash
    : never
  : never;

type EvalItems<
  Database extends GenericDatabase,
  Table extends string,
  Items extends SelectNode[],
  Row = {},
  Filters = {},
> = Items extends [infer Head extends SelectNode, ...infer Tail extends SelectNode[]]
  ? EvalItem<Database, Table, Head> extends infer Evaluated
    ? Evaluated extends { row: infer R; filters: infer F }
      ? EvalItems<Database, Table, Tail, Row & R, Filters & F>
      : Evaluated
    : never
  : { row: Prettify<Row>; filters: Filters };

type EvalItem<
  Database extends GenericDatabase,
  Table extends string,
  Item extends SelectNode,
> = Item extends StarNode
  ? { row: RowOf<Database, Table>; filters: {} }
  : Item extends ColumnNode<infer Name, infer Key>
    ? Name extends keyof RowOf<Database, Table>
      ? { row: { [K in Key]: RowOf<Database, Table>[Name] }; filters: {} }
      : ParseError<`the table "${Table}" has no column "${Name}"`>
    : Item extends AggregateNode<infer Function, infer Column, infer Key>
      ? EvalAggregate<RowOf<Database, Table>, Table, Function, Column, Key>
    : Item extends EmbedNode<infer Name, infer Key, infer Hint, infer Inner, infer Items>
      ? ResolveRelationship<Database, Table, Name, Hint> extends infer Found
        ? Found extends Relationship
          ? EvalEmbed<Database, Found, Name, Key, Inner, Items>
          : Found
        : never
      : never;

/**
 * A count is a number. A sum or average of no rows is null, as is a minimum or maximum. PostgreSQL
 * has no minimum or maximum of a boolean or JSON value.
 */
type EvalAggregate<
  Row,
  Table extends string,
  Function extends AggregateName,
  Column extends string | null,
  Key extends string,
> = Column extends string
  ? Column extends keyof Row
    ? Function extends "count"
      ? { row: { [K in Key]: number }; filters: {} }
      : Function extends "min" | "max"
        ? [NonNullable<Row[Column]>] extends [boolean]
          ? ParseError<`${Function}() cannot read the boolean column "${Column}"`>
          : [Extract<NonNullable<Row[Column]>, Record<string, unknown>>] extends [never]
            ? { row: { [K in Key]: Row[Column] | null }; filters: {} }
            : ParseError<`${Function}() cannot read the JSON column "${Column}"`>
        : [NonNullable<Row[Column]>] extends [number]
          ? { row: { [K in Key]: number | null }; filters: {} }
          : ParseError<`${Function}() reads a number column, and "${Column}" is not one`>
    : ParseError<`the table "${Table}" has no column "${Column}"`>
  : { row: { [K in Key]: number }; filters: {} };

type HasAggregate<Items extends SelectNode[]> = [
  Extract<Items[number], AggregateNode<AggregateName, string | null, string>>,
] extends [never]
  ? false
  : true;

type HasEmbed<Items extends SelectNode[]> = [
  Extract<Items[number], EmbedNode<string, string, string | null, boolean, any[]>>,
] extends [never]
  ? false
  : true;

type EvalEmbed<
  Database extends GenericDatabase,
  R extends Relationship,
  Name extends string,
  Key extends string,
  Inner extends boolean,
  Items extends SelectNode[],
> = HasAggregate<Items> extends true
  ? ParseError<"an embed cannot read an aggregate">
  : (Items extends [] ? { row: {}; filters: {} } : EvalLevel<Database, R["table"], Items>) extends infer Nested
    ? Nested extends Selection
      ? {
          row: Items extends [] ? {} : { [K in Key]: EmbedValue<R, Inner, Nested["row"]> };
          filters: EmbedFilters<RowOf<Database, R["table"]>, Nested["filters"], Key | Name>;
        }
      : Nested
    : never;

/**
 * A to-one embed is one row, or null without `!inner`: a NOT NULL foreign key does not make it
 * non-null, because the OAIZ server joins it with the row-level policies and embedded filters of the request.
 * A to-many embed is a list.
 */
type EmbedValue<R extends Relationship, Inner extends boolean, T> = R["direction"] extends "forward"
  ? Inner extends true
    ? T
    : T | null
  : R["oneToOne"] extends true
    ? Inner extends true
      ? T
      : T | null
    : T[];

/** Filter columns an embed adds: `embed.column` by its key or relation name, and its nested embeds' columns. */
type EmbedFilters<Row, Nested, Prefix extends string> = {
  [C in keyof Row & string as `${Prefix}.${C}`]: Row[C];
} & {
  [P in keyof Nested & string as `${Prefix}.${P}`]: Nested[P];
};

type Evaluate<Database extends GenericDatabase, Table extends string, Query extends string> =
  ParseSelect<CompactSelect<Query>> extends infer Items
    ? Items extends SelectNode[]
      ? HasAggregate<Items> extends true
        ? StarNode extends Items[number]
          ? ParseError<"an aggregate cannot be read beside * or an embed">
          : HasEmbed<Items> extends true
            ? ParseError<"an aggregate cannot be read beside * or an embed">
            : EvalLevel<Database, Table, Items>
        : EvalLevel<Database, Table, Items>
      : Items
    : never;

/** The select argument type: the query when it reads, otherwise an error message. */
export type SelectQuery<
  Database extends GenericDatabase,
  Table extends string,
  Query extends string,
> = IsAny<Database> extends true
  ? Query
  : Evaluate<Database, Table, Query> extends ParseError<infer Message>
    ? Message
    : Query;

/** The select argument type of a write, which cannot return an aggregate. */
export type WriteSelectQuery<
  Database extends GenericDatabase,
  Table extends string,
  Query extends string,
> = IsAny<Database> extends true
  ? Query
  : ParseSelect<CompactSelect<Query>> extends infer Items extends SelectNode[]
    ? HasAggregate<Items> extends true
      ? "a write cannot return an aggregate"
      : SelectQuery<Database, Table, Query>
    : SelectQuery<Database, Table, Query>;

/** Columns `.order()` takes after this select: an aggregated select orders only by its groups. */
export type SelectOrder<
  Database extends GenericDatabase,
  Table extends string,
  Query extends string,
> = IsAny<Database> extends true
  ? string
  : ParseSelect<CompactSelect<Query>> extends infer Items extends SelectNode[]
    ? HasAggregate<Items> extends true
      ? GroupColumn<Items[number]> & OrderColumn<Database, Table>
      : OrderColumn<Database, Table>
    : OrderColumn<Database, Table>;

type GroupColumn<Item> = Item extends ColumnNode<infer Name, string> ? Name : never;

/** One row of what a select string reads. */
export type SelectRow<
  Database extends GenericDatabase,
  Table extends string,
  Query extends string,
> = IsAny<Database> extends true
  ? any
  : Evaluate<Database, Table, Query> extends { row: infer Row }
    ? Row
    : never;

/** Columns a filter takes after this select: the table's own and those of its embeds. */
export type SelectFilters<
  Database extends GenericDatabase,
  Table extends string,
  Query extends string,
> = IsAny<Database> extends true
  ? UntypedRow
  : Evaluate<Database, Table, Query> extends { filters: infer Filters }
    ? Prettify<RowOf<Database, Table> & Filters>
    : RowOf<Database, Table>;
