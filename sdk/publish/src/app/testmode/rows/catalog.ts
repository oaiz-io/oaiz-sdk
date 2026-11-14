// Mirrors the OAIZ server's table catalog and the query it reads from Postgres.

import { tableRequestError } from "./errors";
import { maxTableEmbedDepth, type TableSelectItem } from "./table";

/**
 * The query the OAIZ server reads a table's catalog with. It reads part of the data schema as
 * one JSON document: the table or view $1 names and every table within $2 foreign-key steps of
 * it, each with its columns in attnum order, whether it is a table or a view, and a table's
 * primary, unique and foreign keys. A view has no keys, so it is never a step.
 */
export const tableCatalogQuery = `WITH RECURSIVE reached(oid, steps) AS (
  SELECT c.oid, 0
  FROM pg_class c
  WHERE c.relname = $1::text AND c.relnamespace = to_regnamespace('data') AND c.relkind IN ('r', 'p', 'v')
  UNION
  SELECT other.oid, r.steps + 1
  FROM reached r
  JOIN pg_constraint con ON con.contype = 'f' AND con.conparentid = 0 AND r.oid IN (con.conrelid, con.confrelid)
  JOIN pg_class other ON other.oid = CASE WHEN con.conrelid = r.oid THEN con.confrelid ELSE con.conrelid END
  WHERE r.steps < $2::integer
    AND other.relnamespace = to_regnamespace('data') AND other.relkind IN ('r', 'p')
)
SELECT coalesce(json_agg(json_build_object(
  'name', c.relname,
  'kind', CASE WHEN c.relkind = 'v' THEN 'view' ELSE 'table' END,
  'columns', (
    SELECT coalesce(json_agg(json_build_object(
      'name', a.attname,
      'type', format_type(a.atttypid, a.atttypmod)
    ) ORDER BY a.attnum), '[]')
    FROM pg_attribute a
    WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  ),
  'constraints', (
    SELECT coalesce(json_agg(json_build_object(
      'name', con.conname,
      'kind', con.contype,
      'columns', (
        SELECT json_agg(ka.attname ORDER BY k.ord)
        FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute ka ON ka.attrelid = con.conrelid AND ka.attnum = k.attnum
      ),
      'referencedTable', rc.relname,
      'referencedColumns', (
        SELECT json_agg(fa.attname ORDER BY f.ord)
        FROM unnest(con.confkey) WITH ORDINALITY AS f(attnum, ord)
        JOIN pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = f.attnum
      )
    ) ORDER BY con.conname), '[]')
    FROM pg_constraint con
    LEFT JOIN pg_class rc ON rc.oid = con.confrelid
    WHERE con.conrelid = c.oid
      AND con.contype IN ('p', 'u', 'f')
      AND (con.contype <> 'f' OR (rc.relnamespace = c.relnamespace AND con.conparentid = 0))
  )
) ORDER BY c.relname), '[]')::text
FROM pg_class c
WHERE c.oid IN (SELECT oid FROM reached)`;

/**
 * The parameters of tableCatalogQuery for a request on table whose deepest embed is depth steps
 * away, as the OAIZ server sends them. A name holding a NUL is sent as the empty
 * name, which no table has, and a lone surrogate is sent as U+FFFD, as the OAIZ server's JSON decoding
 * reads it. The depth is sent as text, as every test-mode parameter is, and the query casts it.
 */
export function tableCatalogArguments(table: string, depth: number): string[] {
  return [table.includes("\u0000") ? "" : table.replace(/\p{Cs}/gu, "\uFFFD"), String(depth)];
}

/**
 * How many foreign-key steps from the requested table resolving a request can look at: the depth
 * of its deepest embed, at most maxTableEmbedDepth, as the OAIZ server counts them.
 */
export function catalogDepth(select: TableSelectItem[], depth = 0): number {
  if (depth === maxTableEmbedDepth) return depth;
  let deepest = depth;
  for (const item of select) {
    if (item.embed !== undefined) deepest = Math.max(deepest, catalogDepth(item.embed.select, depth + 1));
  }
  return deepest;
}

/** One column; `type` is format_type's rendering. */
export interface CatalogColumn {
  name: string;
  type: string;
}

export interface CatalogForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

/** A view reads as a table does and takes no writes. */
export type CatalogTableKind = "table" | "view";

export interface CatalogTable {
  name: string;
  kind: CatalogTableKind;
  columns: CatalogColumn[];
  primaryKey: string[];
  uniqueKeys: string[][];
  foreignKeys: CatalogForeignKey[];
}

export type TableRelationshipCardinality = "many-to-one" | "one-to-many" | "one-to-one";

/** One foreign key seen from `table`: columns[i] of table equals foreignColumns[i] of foreignTable. */
export interface TableRelationship {
  table: string;
  foreignTable: string;
  constraint: string;
  cardinality: TableRelationshipCardinality;
  columns: string[];
  foreignColumns: string[];
}

interface CatalogTableRow {
  name: string;
  kind: string;
  columns: CatalogColumn[];
  constraints: {
    name: string;
    kind: string;
    columns: string[] | null;
    referencedTable: string | null;
    referencedColumns: string[] | null;
  }[];
}

export function decodeTableCatalog(document: string): TableCatalog {
  const rows = JSON.parse(document) as CatalogTableRow[];
  return new TableCatalog(
    rows.map((row) => {
      const table: CatalogTable = {
        name: row.name,
        kind: row.kind === "view" ? "view" : "table",
        columns: row.columns,
        primaryKey: [],
        uniqueKeys: [],
        foreignKeys: [],
      };
      for (const constraint of row.constraints) {
        if (constraint.kind === "p") table.primaryKey = constraint.columns ?? [];
        if (constraint.kind === "u") table.uniqueKeys.push(constraint.columns ?? []);
        if (constraint.kind === "f") {
          table.foreignKeys.push({
            name: constraint.name,
            columns: constraint.columns ?? [],
            referencedTable: constraint.referencedTable ?? "",
            referencedColumns: constraint.referencedColumns ?? [],
          });
        }
      }
      return table;
    }),
  );
}

/** The data schema of the test database, as its own catalog describes it. */
export class TableCatalog {
  constructor(readonly tables: CatalogTable[]) {}

  table(name: string): CatalogTable | undefined {
    return this.tables.find((table) => table.name === name);
  }

  /**
   * The one relationship an embed names, with PostgREST's matching rules. Without a hint, target
   * matches the foreign table, the constraint, or the single origin-side column. With a hint,
   * target must be the foreign table and the hint matches the constraint or either single column.
   */
  relationship(origin: string, target: string, hint: string): TableRelationship {
    const matches = this.relationshipsFrom(origin).filter((relationship) =>
      relationshipMatches(relationship, target, hint),
    );
    if (matches.length === 1) return matches[0];
    if (matches.length === 0) {
      throw tableRequestError(
        "relationship-not-found",
        `no foreign key relates the tables ${origin} and ${target}`,
      );
    }
    const choices = matches.map((match) => `${match.foreignTable}!${match.constraint}`);
    throw tableRequestError(
      "relationship-ambiguous",
      `more than one foreign key relates the tables ${origin} and ${target}; name one in the select as ${choices.join(" or ")}`,
    );
  }

  /** The foreign keys origin holds, then the foreign keys other tables hold that reference it. */
  private relationshipsFrom(origin: string): TableRelationship[] {
    const relationships: TableRelationship[] = [];
    for (const holder of this.tables) {
      for (const foreignKey of holder.foreignKeys) {
        const oneToOne = uniqueSet(holder, foreignKey.columns);
        if (holder.name === origin) {
          relationships.push({
            table: origin,
            foreignTable: foreignKey.referencedTable,
            constraint: foreignKey.name,
            cardinality: oneToOne ? "one-to-one" : "many-to-one",
            columns: foreignKey.columns,
            foreignColumns: foreignKey.referencedColumns,
          });
        }
        if (foreignKey.referencedTable === origin) {
          relationships.push({
            table: origin,
            foreignTable: holder.name,
            constraint: foreignKey.name,
            cardinality: oneToOne ? "one-to-one" : "one-to-many",
            columns: foreignKey.referencedColumns,
            foreignColumns: foreignKey.columns,
          });
        }
      }
    }
    return relationships;
  }
}

/** Whether a relationship reaches at most one row, so its embed is an object. */
export function toOne(relationship: TableRelationship): boolean {
  return relationship.cardinality !== "one-to-many";
}

export function catalogColumn(table: CatalogTable, name: string): CatalogColumn | undefined {
  return table.columns.find((column) => column.name === name);
}

/** Whether columns, in any order, are the primary key or one unique constraint's columns. */
function uniqueSet(table: CatalogTable, columns: string[]): boolean {
  return [table.primaryKey, ...table.uniqueKeys].some((key) => sameColumnSet(key, columns));
}

function sameColumnSet(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((column, index) => column === sortedB[index]);
}

function relationshipMatches(
  relationship: TableRelationship,
  target: string,
  hint: string,
): boolean {
  const singleColumn = (name: string) =>
    relationship.columns.length === 1 && relationship.columns[0] === name;
  const singleForeignColumn = (name: string) =>
    relationship.foreignColumns.length === 1 && relationship.foreignColumns[0] === name;
  if (relationship.table === relationship.foreignTable) {
    if (hint === "") {
      return (
        (target === relationship.foreignTable && relationship.cardinality === "one-to-many") ||
        (singleColumn(target) && relationship.cardinality === "many-to-one")
      );
    }
    return (
      target === relationship.foreignTable &&
      relationship.cardinality === "one-to-many" &&
      singleForeignColumn(hint)
    );
  }
  if (hint === "") {
    return (
      target === relationship.foreignTable ||
      target === relationship.constraint ||
      singleColumn(target)
    );
  }
  return (
    target === relationship.foreignTable &&
    (hint === relationship.constraint || singleColumn(hint) || singleForeignColumn(hint))
  );
}
