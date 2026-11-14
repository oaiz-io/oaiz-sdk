import { describe, it } from "vitest";

import { db } from "./helpers";

describe("members OAIZ does not support", () => {
  it("are type errors", () => {
    const query = db.from("deals").select("id");
    // @ts-expect-error maybeSingle
    query.maybeSingle();
    // @ts-expect-error textSearch
    query.textSearch("name", "acme");
    // @ts-expect-error match
    query.match({ stage: "open" });
    // @ts-expect-error filter
    query.filter("stage", "eq", "open");
    // @ts-expect-error csv
    query.csv();
    // @ts-expect-error throwOnError
    query.throwOnError();
    // @ts-expect-error returns
    query.returns<{ id: string }[]>();
    // @ts-expect-error overrideTypes
    query.overrideTypes<{ id: string }[]>();
    // @ts-expect-error abortSignal
    query.abortSignal(new AbortController().signal);
    // @ts-expect-error head
    db.from("deals").select("id", { head: true });
    // @ts-expect-error referencedTable on order
    query.order("id", { referencedTable: "companies" });
    // @ts-expect-error referencedTable on or
    query.or("name.eq.Acme", { referencedTable: "companies" });
    // @ts-expect-error a count other than exact
    db.from("deals").select("id", { count: "planned" });
    // @ts-expect-error a count other than exact
    db.from("deals").insert({ name: "Acme", owner_id: "u-1" }, { count: "estimated" });
  });
});
