/**
 * JSON that keeps every number as the digits it was written with, as the OAIZ server's decoder does with
 * `UseNumber`. A bigint past 2^53 reaches PostgreSQL, and comes back to the app, unchanged.
 */

/** A JSON number as its literal text. */
export class JsonNumber {
  constructor(readonly text: string) {}
}

/** An object keeps its keys in the order they were read; a repeated key keeps its last value. */
export type JsonObject = Map<string, JsonValue>;

export type JsonValue = null | boolean | string | JsonNumber | JsonValue[] | JsonObject;

/** A text that is not JSON, in the words of Go's decoder. */
export class JsonSyntaxError extends Error {}

/** Reads one JSON value that is the whole of `text`. */
export function parseJson(text: string): JsonValue {
  const reader = new JsonReader(text);
  const value = reader.value();
  reader.space();
  if (!reader.atEnd()) throw reader.unexpected("after top-level value");
  return value;
}

/**
 * Reads the first JSON value of `text` and ignores whatever follows it, as a Go `json.Decoder`
 * reads one request body. Text with no value fails as `EOF`.
 */
export function parseFirstJson(text: string): JsonValue {
  const reader = new JsonReader(text);
  reader.space();
  if (reader.atEnd()) throw new JsonSyntaxError("EOF");
  return reader.value();
}

class JsonReader {
  private position = 0;

  constructor(private readonly text: string) {}

  atEnd(): boolean {
    return this.position >= this.text.length;
  }

  space(): void {
    while (!this.atEnd() && " \t\r\n".includes(this.text[this.position])) this.position++;
  }

  unexpected(context: string): JsonSyntaxError {
    if (this.atEnd()) return new JsonSyntaxError("unexpected EOF");
    return new JsonSyntaxError(`invalid character '${this.text[this.position]}' ${context}`);
  }

  value(): JsonValue {
    this.space();
    const char = this.text[this.position];
    if (char === "{") return this.object();
    if (char === "[") return this.array();
    if (char === '"') return this.string();
    if (char === "-" || (char >= "0" && char <= "9")) return this.number();
    for (const [word, value] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ] as const) {
      if (this.text.startsWith(word, this.position)) {
        this.position += word.length;
        return value;
      }
    }
    throw this.unexpected("looking for beginning of value");
  }

  private object(): JsonObject {
    this.position++;
    const object: JsonObject = new Map();
    this.space();
    if (this.text[this.position] === "}") {
      this.position++;
      return object;
    }
    for (;;) {
      this.space();
      if (this.text[this.position] !== '"')
        throw this.unexpected("looking for beginning of object key string");
      const key = this.string();
      this.space();
      if (this.text[this.position] !== ":") throw this.unexpected("after object key");
      this.position++;
      object.set(key, this.value());
      this.space();
      const next = this.text[this.position];
      this.position++;
      if (next === "}") return object;
      if (next !== ",") {
        this.position--;
        throw this.unexpected("after object key:value pair");
      }
    }
  }

  private array(): JsonValue[] {
    this.position++;
    const array: JsonValue[] = [];
    this.space();
    if (this.text[this.position] === "]") {
      this.position++;
      return array;
    }
    for (;;) {
      array.push(this.value());
      this.space();
      const next = this.text[this.position];
      this.position++;
      if (next === "]") return array;
      if (next !== ",") {
        this.position--;
        throw this.unexpected("after array element");
      }
    }
  }

  private string(): string {
    const start = this.position;
    this.position++;
    for (;;) {
      if (this.atEnd()) throw new JsonSyntaxError("unexpected EOF");
      const char = this.text[this.position];
      if (char === '"') break;
      if (char < " ") throw this.unexpected("in string literal");
      this.position += char === "\\" ? 2 : 1;
    }
    this.position++;
    try {
      return JSON.parse(this.text.slice(start, this.position)) as string;
    } catch {
      this.position = start;
      throw this.unexpected("in string escape code");
    }
  }

  private number(): JsonNumber {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      this.text.slice(this.position),
    );
    if (!match) {
      this.position++;
      throw this.unexpected("in numeric literal");
    }
    this.position += match[0].length;
    return new JsonNumber(match[0]);
  }
}

/**
 * Writes `value` as Go's `json.Marshal` writes a map: keys sorted by code point, `<`, `>`, `&`
 * and the line separators escaped, a `JsonNumber` as its digits and a bigint in full. A `Map` or a
 * plain object is an object; an `undefined` member is left out.
 */
export function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof JsonNumber) return value.text;
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "bigint":
      return value.toString();
    case "number":
      if (!Number.isFinite(value)) throw new TypeError(`${value} is not a JSON number`);
      return JSON.stringify(value);
    case "string":
      return stringifyString(value);
  }
  if (value instanceof Date) return stringifyString(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((element) => stringifyJson(element)).join(",")}]`;
  const entries =
    value instanceof Map
      ? [...(value as Map<string, unknown>).entries()]
      : Object.entries(value as Record<string, unknown>);
  const members = entries
    .filter(([, member]) => member !== undefined)
    .sort(([a], [b]) => compareCodePoints(a, b))
    .map(([key, member]) => `${stringifyString(key)}:${stringifyJson(member)}`);
  return `{${members.join(",")}}`;
}

function stringifyString(value: string): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

/** Orders strings by code point, which is the byte order of their UTF-8 text. */
export function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const difference = left[index].codePointAt(0)! - right[index].codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}
