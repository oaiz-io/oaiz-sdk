// Mirrors the OAIZ server's table statements for document reads and writes:
// the same statement text, and every value bound as a parameter.

import { toOne, type CatalogColumn } from "./catalog";
import {
  groupColumns,
  isAggregated,
  type ResolvedTableColumn,
  type ResolvedTableEmbed,
  type ResolvedTableNode,
  type ResolvedTableRead,
  type ResolvedTableWrite,
  type ResolvedTableWriteGroup,
} from "./resolve";
import {
  maxTableNodeRows,
  type TableAggregate,
  type TableCondition,
  type TableFilter,
  type TableOrder,
  type TableStatement,
} from "./table";

const tableSourceName = `"oaiz_source"`;
const tableMutationName = `"oaiz_mutation"`;
const tablePayloadAlias = `"r"`;

/** The page selected into a common table expression, aggregated beside the count. */
export function compileRead(read: ResolvedTableRead): TableStatement {
  const builder = new TableStatementBuilder();
  const root = builder.node(read.root);
  const where = whereOf(root);
  const page = builder.page(root, read);
  let total = "NULL::bigint";
  if (read.count === "exact") {
    const rows = where === "" ? root.from : `${root.from} WHERE ${where}`;
    if (!isAggregated(read.root)) total = `(SELECT count(*) FROM ${rows})`;
    else if (root.groups.length === 0) total = "1::bigint";
    else
      total = `(SELECT count(*) FROM (SELECT 1 FROM ${rows} GROUP BY ${root.groups.join(", ")}) AS "g")`;
  }
  return builder.statement(
    `WITH ${tableSourceName} AS (${page}) SELECT ${total}, count(*), ${documentBody(read.singular)} FROM ${tableSourceName}`,
  );
}

/**
 * A data-modifying common table expression that returns every changed row, and a representation
 * that reads those rows as a read reads a table. The body is bound as json and read into typed
 * columns with the catalog's column types.
 */
export function compileWrite(write: ResolvedTableWrite): TableStatement {
  const builder = new TableStatementBuilder();
  const target = builder.nextAlias();
  const table = `${quoteQualified("data", write.table)} AS ${target}`;
  const expressions: string[] = [];
  if (write.kind === "insert") {
    const returning = ` RETURNING ${target}.*`;
    if (write.groups.length === 1) {
      expressions.push(
        `${tableMutationName} AS (${builder.insert(table, write, write.groups[0])}${returning})`,
      );
    } else {
      const parts = write.groups.map((group, index) => {
        const name = quoteTableIdentifier(`oaiz_write${index}`);
        expressions.push(`${name} AS (${builder.insert(table, write, group)}${returning})`);
        return `SELECT * FROM ${name}`;
      });
      expressions.push(`${tableMutationName} AS (${parts.join(" UNION ALL ")})`);
    }
  } else {
    const statement =
      write.kind === "update" ? builder.update(table, write) : `DELETE FROM ${table}`;
    const where = builder.filter(target, write.filter);
    expressions.push(`${tableMutationName} AS (${statement} WHERE ${where} RETURNING ${target}.*)`);
  }

  if (write.representation === undefined) {
    const total = write.count === "exact" ? "count(*)" : "NULL::bigint";
    return builder.statement(
      `WITH ${expressions.join(", ")} SELECT ${total}, count(*), NULL::text FROM ${tableMutationName}`,
    );
  }
  const root = builder.node(write.representation);
  root.from = `${tableMutationName} AS ${root.alias}`;
  expressions.push(`${tableSourceName} AS (${selectSQL(root)})`);
  const changed = `(SELECT count(*) FROM ${tableMutationName})`;
  const total = write.count === "exact" ? changed : "NULL::bigint";
  return builder.statement(
    `WITH ${expressions.join(", ")} SELECT ${total}, ${changed}, ${documentBody(write.singular)} FROM ${tableSourceName}`,
  );
}

/** The source rows as one JSON document: an array, or the first row alone for a single request. */
function documentBody(singular: boolean): string {
  if (singular) return `coalesce(json_agg(${tableSourceName}.*)->0, 'null')::text`;
  return `coalesce(json_agg(${tableSourceName}.*), '[]')::text`;
}

/** The column definition list a payload is read with: each column with its catalog type. */
function payloadRecord(columns: CatalogColumn[]): string {
  const definitions = columns.map(
    (column) => `${quoteTableIdentifier(column.name)} ${column.type}`,
  );
  return `${tablePayloadAlias}(${definitions.join(", ")})`;
}

/** One table of the statement as fragments its parent assembles. */
interface CompiledTableNode {
  index: number;
  alias: string;
  from: string;
  items: string[];
  joins: string[];
  conditions: string[];
  /** One EXISTS test for each inner embed. */
  exists: string[];
  /** The GROUP BY terms of an aggregated node. */
  groups: string[];
}

function whereOf(node: CompiledTableNode): string {
  return [...node.conditions, ...node.exists].join(" AND ");
}

function selectSQL(node: CompiledTableNode): string {
  let rows = `SELECT ${node.items.join(", ")} FROM ${node.from}`;
  for (const join of node.joins) rows += ` ${join}`;
  const where = whereOf(node);
  if (where !== "") rows += ` WHERE ${where}`;
  if (node.groups.length > 0) rows += ` GROUP BY ${node.groups.join(", ")}`;
  return rows;
}

const comparisonOperators: Record<string, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
  ilike: "ILIKE",
};

const isTests: Record<string, string> = {
  null: "IS NULL",
  true: "IS TRUE",
  false: "IS FALSE",
};

const aggregateFunctions: Record<TableAggregate, string> = {
  avg: "avg",
  count: "count",
  max: "max",
  min: "min",
  sum: "sum",
};

/** One output column. A count without a column counts rows. */
function columnItem(alias: string, column: ResolvedTableColumn): string {
  let item = `${alias}.${quoteTableIdentifier(column.name)}`;
  if (column.aggregate !== undefined) {
    const argument = column.name === "" ? "*" : item;
    item = `${aggregateFunctions[column.aggregate]}(${argument})`;
  }
  return column.alias !== "" ? `${item} AS ${quoteTableIdentifier(column.alias)}` : item;
}

/** Numbers the bind parameters and the table aliases of one statement. */
class TableStatementBuilder {
  private readonly args: string[] = [];
  private aliases = 0;

  statement(sql: string): TableStatement {
    return { sql, args: this.args };
  }

  nextAlias(): string {
    return quoteTableIdentifier(`t${this.aliases++}`);
  }

  param(value: string | number | bigint): string {
    this.args.push(String(value));
    return `$${this.args.length}`;
  }

  /** The requested rows of root: its select, then the order, the limit and the offset. */
  page(root: CompiledTableNode, read: ResolvedTableRead): string {
    let page = selectSQL(root);
    if (read.order.length > 0)
      page += ` ORDER BY ${read.order.map((term) => orderTerm(root.alias, term)).join(", ")}`;
    page += ` LIMIT ${this.param(read.limit)}`;
    page += ` OFFSET ${this.param(read.offset)}`;
    return page;
  }

  node(node: ResolvedTableNode): CompiledTableNode {
    const index = this.aliases;
    const alias = this.nextAlias();
    const compiled: CompiledTableNode = {
      index,
      alias,
      from: `${quoteQualified("data", node.table)} AS ${alias}`,
      items: node.columns.map((column) => columnItem(alias, column)),
      joins: [],
      conditions: [],
      exists: [],
      groups: isAggregated(node)
        ? groupColumns(node).map((column) => `${alias}.${quoteTableIdentifier(column)}`)
        : [],
    };
    const filter = this.filter(alias, node.filter);
    if (filter !== "") compiled.conditions.push(filter);
    for (const embed of node.embeds) this.embed(compiled, embed);
    return compiled;
  }

  /**
   * A projected embed is a lateral join: a to-one embed is the one row as an object or null, a
   * to-many embed at most maxTableNodeRows rows as an array. An inner embed also keeps only the
   * parent rows that have such a row. An embed that is neither renders nothing and binds nothing.
   */
  private embed(parent: CompiledTableNode, embed: ResolvedTableEmbed): void {
    if (!embed.inner && !embed.projected) return;
    const child = this.node(embed.node);
    const relationship = embed.relationship;
    const joinConditions = relationship.columns.map(
      (column, index) =>
        `${child.alias}.${quoteTableIdentifier(relationship.foreignColumns[index])} = ${parent.alias}.${quoteTableIdentifier(column)}`,
    );
    child.conditions = [...joinConditions, ...child.conditions];
    const where = whereOf(child);
    if (embed.inner) parent.exists.push(`EXISTS (SELECT 1 FROM ${child.from} WHERE ${where})`);
    if (!embed.projected) return;

    const row = quoteTableIdentifier(`s${child.index}`);
    const joined = quoteTableIdentifier(`e${child.index}`);
    let rows = `SELECT ${child.items.join(", ")} FROM ${child.from}`;
    for (const join of child.joins) rows += ` ${join}`;
    rows += ` WHERE ${where}`;
    const name = quoteTableIdentifier(embed.name);
    if (toOne(relationship)) {
      parent.joins.push(
        `LEFT JOIN LATERAL (SELECT to_json(${row}.*) AS "j" FROM (${rows}) AS ${row}) AS ${joined} ON TRUE`,
      );
      parent.items.push(`${joined}."j" AS ${name}`);
      return;
    }
    rows += ` LIMIT ${maxTableNodeRows}`;
    parent.joins.push(
      `LEFT JOIN LATERAL (SELECT json_agg(${row}.*) AS "j" FROM (${rows}) AS ${row}) AS ${joined} ON TRUE`,
    );
    parent.items.push(`coalesce(${joined}."j", '[]') AS ${name}`);
  }

  /** A group of more than one term is parenthesised, so it composes with the conditions around it. */
  filter(alias: string, group: TableFilter): string {
    if (group.terms.length === 0) return "";
    const parts = group.terms.map((term) =>
      term.group ? this.filter(alias, term.group) : this.condition(alias, term.condition!),
    );
    const body = parts.join(group.or ? " OR " : " AND ");
    if (group.negated) return `NOT (${body})`;
    return parts.length > 1 ? `(${body})` : body;
  }

  /** A value is bound as text, so PostgreSQL reads it with the input function of its column's type. */
  private condition(alias: string, condition: TableCondition): string {
    const column = `${alias}.${quoteTableIdentifier(condition.column)}`;
    let expression: string;
    if (condition.operator === "is") expression = `${column} ${isTests[condition.is]}`;
    else if (condition.operator === "in")
      expression = `${column} = ANY(${this.param(tableArrayLiteral(condition.values))})`;
    else
      expression = `${column} ${comparisonOperators[condition.operator]} ${this.param(condition.value)}`;
    return condition.negated ? `NOT (${expression})` : expression;
  }

  /** One INSERT of group's rows, up to where a RETURNING clause goes. */
  insert(table: string, write: ResolvedTableWrite, group: ResolvedTableWriteGroup): string {
    let statement = `INSERT INTO ${table}`;
    if (group.columns.length === 0) {
      statement += ` SELECT FROM json_array_elements(${this.param(group.rows)}::json)`;
    } else {
      const names = group.columns.map((column) => quoteTableIdentifier(column.name));
      const values = group.columns.map(
        (column) => `${tablePayloadAlias}.${quoteTableIdentifier(column.name)}`,
      );
      statement += ` (${names.join(", ")}) SELECT ${values.join(", ")} FROM json_to_recordset(${this.param(group.rows)}::json) AS ${payloadRecord(group.columns)}`;
    }
    if (write.resolution !== "") {
      statement += ` ON CONFLICT (${write.conflictColumns.map(quoteTableIdentifier).join(", ")})`;
      const assignments =
        write.resolution === "merge"
          ? write.mergeColumns.map(
              (column) =>
                `${quoteTableIdentifier(column)} = EXCLUDED.${quoteTableIdentifier(column)}`,
            )
          : [];
      statement +=
        assignments.length > 0 ? ` DO UPDATE SET ${assignments.join(", ")}` : " DO NOTHING";
    }
    return statement;
  }

  /** The UPDATE and its SET list, up to where its filter goes. */
  update(table: string, write: ResolvedTableWrite): string {
    const group = write.groups[0];
    const assignments = group.columns.map((column) => {
      const name = quoteTableIdentifier(column.name);
      return `${name} = ${tablePayloadAlias}.${name}`;
    });
    const from = ` FROM json_to_record(${this.param(group.rows)}::json) AS ${payloadRecord(group.columns)}`;
    return `UPDATE ${table} SET ${assignments.join(", ")}${from}`;
  }
}

function orderTerm(alias: string, term: TableOrder): string {
  let rendered = `${alias}.${quoteTableIdentifier(term.column)} ${term.descending ? "DESC" : "ASC"}`;
  if (term.nulls === "first") rendered += " NULLS FIRST";
  if (term.nulls === "last") rendered += " NULLS LAST";
  return rendered;
}

/** An in list as one array literal. Every element is quoted, so the text null is a value. */
function tableArrayLiteral(values: string[]): string {
  return `{${values.map((value) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")}}`;
}

/** Quotes a name as pgx's Identifier.Sanitize does. */
function quoteTableIdentifier(name: string): string {
  return `"${name.replaceAll("\0", "").replaceAll('"', '""')}"`;
}

function quoteQualified(schema: string, name: string): string {
  return `${quoteTableIdentifier(schema)}.${quoteTableIdentifier(name)}`;
}
