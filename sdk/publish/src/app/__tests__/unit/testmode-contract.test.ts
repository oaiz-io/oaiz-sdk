// The row contract against the test mode: Core's golden test schema and the contract seed in a
// tests folder, and each case sent through the server's handle as its member through the app.
// Core runs the same cases against itself, and both runners compare an answer the same way.
import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  JsonNumber,
  parseJson,
  stringifyJson,
  type JsonObject,
  type JsonValue,
} from "../../testmode/json";
import type { OaizTestMembers } from "../../testmode/members";
import { createTestServer, type OaizTestServer } from "../../testmode/server";
import { testFolder, type TestFolder } from "../fixtures/testmode-folder";

const contractDirectory = new URL("../fixtures/rowcontract/", import.meta.url);

/** A request a case sends before its own, as the same member; it succeeds. */
interface ContractStep {
  operation: string;
  request: JsonValue;
}

interface ContractCase {
  name: string;
  member: string;
  grant: "view" | "edit";
  before: ContractStep[];
  operation: string;
  request: JsonValue;
  want: {
    status: number;
    slug: string;
    rows: JsonValue | undefined;
    count: string | undefined;
    data: JsonValue | undefined;
    sqlState: string;
  };
}

interface Contract {
  app: string;
  grant: "view" | "edit";
  members: OaizTestMembers;
  cases: ContractCase[];
}

const sqlSlugs = ["storage-customer-sql-failed", "storage-customer-sql-permission-denied"];

/** Reads cases.json and refuses a field at any level that Core's runner does not read. */
function readContract(text: string): Contract {
  const root = object(parseJson(text), "cases.json", [
    "app",
    "grant",
    "teams",
    "members",
    "cases",
  ]);
  const grant = string(root.get("grant"), "grant") as "view" | "edit";
  const teams = array(root.get("teams"), "teams").map((team, index) => {
    const fields = object(team, `teams[${index}]`, ["id", "name"]);
    return {
      id: string(fields.get("id"), "team id"),
      name: string(fields.get("name"), "team name"),
    };
  });
  const members = array(root.get("members"), "members").map((member, index) => {
    const fields = object(member, `members[${index}]`, ["id", "name", "email", "teams"]);
    return {
      id: string(fields.get("id"), "member id"),
      name: string(fields.get("name"), "member name"),
      email: string(fields.get("email"), "member email"),
      teams: array(fields.get("teams"), "member teams").map((team) => string(team, "member team")),
    };
  });
  const cases = array(root.get("cases"), "cases").map((value, index): ContractCase => {
    const fields = object(value, `cases[${index}]`, [
      "name",
      "member",
      "grant",
      "before",
      "operation",
      "request",
      "kind",
      "want",
    ]);
    const name = string(fields.get("name"), "case name");
    const want = object(fields.get("want"), `${name} want`, [
      "status",
      "slug",
      "rows",
      "count",
      "data",
      "sqlState",
    ]);
    const count = want.get("count");
    const before = fields.get("before");
    return {
      name,
      member: string(fields.get("member"), `${name} member`),
      grant: (optionalString(fields.get("grant")) || grant) as "view" | "edit",
      before: (before === undefined ? [] : array(before, `${name} before`)).map((step, stepIndex) => {
        const stepFields = object(step, `${name} before[${stepIndex}]`, ["operation", "request"]);
        return {
          operation: string(stepFields.get("operation"), `${name} before operation`),
          request: stepFields.get("request") ?? null,
        };
      }),
      operation: string(fields.get("operation"), `${name} operation`),
      request: fields.get("request") ?? null,
      want: {
        status: Number(number(want.get("status"), `${name} status`)),
        slug: optionalString(want.get("slug")),
        rows: want.get("rows"),
        count: count === undefined || count === null ? undefined : number(count, `${name} count`),
        data: want.get("data"),
        sqlState: optionalString(want.get("sqlState")),
      },
    };
  });
  return {
    app: string(root.get("app"), "app"),
    grant,
    members: { teams, members, grants: {} },
    cases,
  };
}

function object(value: JsonValue | undefined, what: string, fields?: string[]): JsonObject {
  if (!(value instanceof Map)) throw new Error(`${what} is not an object`);
  for (const key of value.keys()) {
    if (fields && !fields.includes(key)) throw new Error(`${what} has the unknown field ${key}`);
  }
  return value;
}

function array(value: JsonValue | undefined, what: string): JsonValue[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not an array`);
  return value;
}

function string(value: JsonValue | undefined, what: string): string {
  if (typeof value !== "string") throw new Error(`${what} is not a string`);
  return value;
}

function optionalString(value: JsonValue | undefined): string {
  return value === undefined || value === null ? "" : string(value, "field");
}

function number(value: JsonValue | undefined, what: string): string {
  if (!(value instanceof JsonNumber)) throw new Error(`${what} is not a number`);
  return value.text;
}

/**
 * Rows as comparable JSON text: numbers keep their literal digits, object keys are sorted, and
 * every array nested in a row is sorted, because PostgreSQL does not order an embed's rows. ordered
 * keeps the order of the rows themselves, which a read's order decides and a write's does not.
 */
function canonicalRows(value: JsonValue | undefined, ordered: boolean): string {
  if (!Array.isArray(value)) throw new Error(`rows is an array, not ${stringifyJson(value)}`);
  const texts = value.map((row) => canonicalJSON(row, true));
  if (!ordered) texts.sort();
  return `[${texts.join(",\n")}]`;
}

function canonicalJSON(value: JsonValue, top: boolean): string {
  if (value instanceof Map) {
    const keys = [...value.keys()].sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJSON(value.get(key)!, false)}`).join(",")}}`;
  }
  if (Array.isArray(value)) {
    const parts = value.map((element) => canonicalJSON(element, false));
    if (!top) parts.sort();
    return `[${parts.join(",")}]`;
  }
  return stringifyJson(value);
}

/** The operation that calls a function, which Core serves at its own path. */
const callOperation = "call";

function operationPath(operation: string): string {
  return operation === callOperation ? "functions/call" : `rows/${operation}`;
}

const contract = readContract(readFileSync(new URL("cases.json", contractDirectory), "utf8"));
const schemaSQL = readFileSync(new URL("test_schema.sql", contractDirectory), "utf8");
const seedSQL = readFileSync(new URL("seed.sql", contractDirectory), "utf8");
const DB = "7e570000-0000-4000-8000-0000000000d1";
const folders: TestFolder[] = [];
const servers = new Map<string, OaizTestServer>();

beforeAll(async () => {
  for (const grant of new Set(contract.cases.map((contractCase) => contractCase.grant))) {
    const members: OaizTestMembers = { ...contract.members, grants: { [DB]: grant } };
    const folder = await testFolder({
      "members.json": JSON.stringify(members),
      [`databases/${DB}.sql`]: schemaSQL,
      [`databases/${DB}.seed.sql`]: seedSQL,
    });
    folders.push(folder);
    const server = await createTestServer({ directory: folder.directory });
    servers.set(grant, server);
    // The first request opens the database.
    await server.handle(
      new Request(`http://app.example.test/__oaiz-test/storage/databases/${DB}/rows/select`, {
        method: "POST",
        headers: { authorization: `Bearer ${server.issueToken(contract.members.members[0].id, contract.app)}` },
        body: '{"table":"projects"}',
      }),
    );
  }
}, 60_000);

afterAll(async () => {
  for (const server of servers.values()) await server.close();
  for (const folder of folders) await folder.dispose();
});

describe("row contract", () => {
  it("has cases, and each names a member of the contract", () => {
    expect(contract.cases.length).toBeGreaterThan(0);
    const members = new Set(contract.members.members.map((member) => member.id));
    for (const contractCase of contract.cases)
      expect(members.has(contractCase.member), contractCase.name).toBe(true);
  });

  it.each(contract.cases.map((contractCase) => [contractCase.name, contractCase] as const))(
    "%s",
    async (_, contractCase) => {
      const server = servers.get(contractCase.grant)!;
      await server.reset();
      const send = (operation: string, request: JsonValue) =>
        server.handle(
          new Request(`http://app.example.test/__oaiz-test/storage/databases/${DB}/${operationPath(operation)}`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${server.issueToken(contractCase.member, contract.app)}`,
              "content-type": "application/json",
            },
            body: stringifyJson(request),
          }),
        );
      for (const step of contractCase.before) {
        const before = await send(step.operation, step.request);
        expect(before.status, await before.text()).toBe(200);
      }
      const response = await send(contractCase.operation, contractCase.request);
      const text = await response.text();
      const want = contractCase.want;
      expect(response.status, text).toBe(want.status);
      const answer = object(parseJson(text), "answer");
      if (want.status !== 200) {
        expect(answer.get("slug"), text).toBe(want.slug);
        if (sqlSlugs.includes(want.slug)) {
          const message = string(answer.get("message"), "message");
          expect(/\(sqlstate ([0-9A-Z]{5})/.exec(message)?.[1], text).toBe(want.sqlState);
        }
        return;
      }
      if (contractCase.operation === callOperation) {
        expect([...answer.keys()].sort(), text).toEqual(["data"]);
        expect(canonicalJSON(answer.get("data")!, true), text).toBe(
          canonicalJSON(want.data!, true),
        );
        return;
      }
      const ordered = contractCase.operation === "select";
      expect(canonicalRows(answer.get("rows"), ordered), text).toBe(
        canonicalRows(want.rows, ordered),
      );
      const count = answer.get("count");
      expect(count === undefined ? undefined : number(count, "count"), text).toBe(want.count);
    },
  );
});
