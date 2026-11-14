import type {
  DtoStorageRowFilter,
  DtoStorageRowFilterOperator,
} from "../models";

/** A filter string that cannot become a rows request. */
export class FilterParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterParseError";
  }
}

const OPERATORS: readonly string[] = [
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

const IS_VALUES: readonly string[] = ["null", "true", "false"];

/** `like` and `ilike` patterns read `*` as `%`, so patterns survive URL-style quoting. */
export function likePattern(pattern: string): string {
  return pattern.replace(/\*/g, "%");
}

/** One condition from an operator name and its raw text value. */
export function condition(
  column: string,
  operator: string,
  raw: string,
  not: boolean,
): DtoStorageRowFilter {
  if (OPERATORS.indexOf(operator) < 0) {
    throw new FilterParseError(`unknown operator ${operator} on ${column}`);
  }
  const filter: DtoStorageRowFilter = {
    column,
    operator: operator as DtoStorageRowFilterOperator,
  };
  if (operator === "in") {
    filter.values = parseList(raw, column);
  } else if (operator === "is") {
    if (IS_VALUES.indexOf(raw) < 0) {
      throw new FilterParseError(`is on ${column} takes null, true or false`);
    }
    filter.value = raw;
  } else if (operator === "like" || operator === "ilike") {
    filter.value = likePattern(raw);
  } else {
    filter.value = raw;
  }
  if (not) {
    filter.not = true;
  }
  return filter;
}

/** Parses a logic string such as `a.eq.1,and(b.gt.2,not.c.is.null)` into the members of one group. */
export function parseLogic(text: string): DtoStorageRowFilter[] {
  const parser = new LogicParser(text);
  const filters = parser.list();
  if (!parser.done()) {
    throw new FilterParseError(
      `unexpected ${JSON.stringify(text.charAt(parser.position))} at ${parser.position} in ${JSON.stringify(text)}`,
    );
  }
  return filters;
}

function parseList(raw: string, column: string): string[] {
  if (raw.charAt(0) !== "(" || raw.charAt(raw.length - 1) !== ")") {
    throw new FilterParseError(`in on ${column} takes a list such as (a,b)`);
  }
  const parser = new LogicParser(raw.slice(1, -1));
  const values: string[] = [];
  if (parser.done()) {
    return values;
  }
  for (;;) {
    values.push(parser.value());
    if (parser.done()) {
      return values;
    }
    parser.expect(",");
  }
}

class LogicParser {
  position = 0;

  constructor(private readonly text: string) {}

  done(): boolean {
    return this.position >= this.text.length;
  }

  expect(char: string): void {
    if (this.text.charAt(this.position) !== char) {
      throw new FilterParseError(
        `expected ${JSON.stringify(char)} at ${this.position} in ${JSON.stringify(this.text)}`,
      );
    }
    this.position += 1;
  }

  /** Items separated by commas; spaces and tabs before an item are skipped, as PostgREST does. */
  list(): DtoStorageRowFilter[] {
    this.skipSpace();
    const filters = [this.item()];
    while (this.text.charAt(this.position) === ",") {
      this.position += 1;
      this.skipSpace();
      filters.push(this.item());
    }
    return filters;
  }

  skipSpace(): void {
    while (!this.done() && " \t".indexOf(this.text.charAt(this.position)) >= 0) {
      this.position += 1;
    }
  }

  item(): DtoStorageRowFilter {
    let not = false;
    if (this.text.startsWith("not.", this.position)) {
      const rest = this.text.slice(this.position + 4);
      if (rest.startsWith("and(") || rest.startsWith("or(")) {
        not = true;
        this.position += 4;
      }
    }
    for (const kind of ["and", "or"] as const) {
      if (this.text.startsWith(`${kind}(`, this.position)) {
        this.position += kind.length + 1;
        const members = this.list();
        this.expect(")");
        const group: DtoStorageRowFilter =
          kind === "and" ? { and: members } : { or: members };
        if (not) {
          group.not = true;
        }
        return group;
      }
    }
    const column = this.column();
    this.expect(".");
    let operator = this.name("operator");
    let negated = false;
    if (operator === "not") {
      negated = true;
      this.expect(".");
      operator = this.name("operator");
    }
    this.expect(".");
    const raw = operator === "in" ? this.inList() : this.value();
    return condition(column, operator, raw, negated);
  }

  /**
   * A double-quoted column name, or an unquoted one without its surrounding spaces. The OAIZ server reads a
   * group member's column as given, so the name is sent as the table names it.
   */
  column(): string {
    if (this.text.charAt(this.position) === '"') {
      return this.quoted();
    }
    const column = this.name("column").trim();
    if (column === "") {
      throw new FilterParseError(`expected a column in ${JSON.stringify(this.text)}`);
    }
    return column;
  }

  /** A column or operator name: everything up to the next `.`, `,`, `(` or `)`. */
  name(what: string): string {
    const start = this.position;
    while (!this.done() && ".,()".indexOf(this.text.charAt(this.position)) < 0) {
      this.position += 1;
    }
    if (this.position === start) {
      throw new FilterParseError(
        `expected a ${what} at ${start} in ${JSON.stringify(this.text)}`,
      );
    }
    return this.text.slice(start, this.position);
  }

  /** The `(…)` text of an `in` list, kept whole for `parseList`. */
  inList(): string {
    const start = this.position;
    this.expect("(");
    while (this.text.charAt(this.position) !== ")") {
      if (this.done()) {
        throw new FilterParseError(
          `unclosed in list at ${start} in ${JSON.stringify(this.text)}`,
        );
      }
      if (this.text.charAt(this.position) === '"') {
        this.quoted();
      } else {
        this.position += 1;
      }
    }
    this.position += 1;
    return this.text.slice(start, this.position);
  }

  /** A double-quoted value with backslash escapes, or plain text up to `,` or `)`. */
  value(): string {
    if (this.text.charAt(this.position) === '"') {
      const value = this.quoted();
      if (!this.done() && ",)".indexOf(this.text.charAt(this.position)) < 0) {
        throw new FilterParseError(
          `unexpected text after a quoted value at ${this.position} in ${JSON.stringify(this.text)}`,
        );
      }
      return value;
    }
    const start = this.position;
    while (!this.done() && ",)".indexOf(this.text.charAt(this.position)) < 0) {
      this.position += 1;
    }
    return this.text.slice(start, this.position);
  }

  quoted(): string {
    const start = this.position;
    this.position += 1;
    let value = "";
    while (!this.done()) {
      const char = this.text.charAt(this.position);
      if (char === '"') {
        this.position += 1;
        return value;
      }
      if (char === "\\") {
        this.position += 1;
        if (this.done()) {
          break;
        }
      }
      value += this.text.charAt(this.position);
      this.position += 1;
    }
    throw new FilterParseError(
      `unclosed quoted value at ${start} in ${JSON.stringify(this.text)}`,
    );
  }
}
