import { describe, expectTypeOf, it } from "vitest";

import { createClient } from "../../index";
import type {
  FunctionArgs,
  FunctionName,
  FunctionReturns,
  SelectQuery,
  WriteSelectQuery,
} from "../../types";
import type { Database, Json } from "../fixtures/database";
import { type DataOf, db } from "./helpers";

type Company = Database["data"]["Tables"]["companies"]["Row"];
type Deal = Database["data"]["Tables"]["deals"]["Row"];

describe("select", () => {
  it("reads every column without a select string", () => {
    const query = db.from("deals").select();
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<Deal[]>();
  });

  it("reads a view as a table, with its nullable columns and its filters", () => {
    const query = db.from("open_deals").select();
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<
      Database["data"]["Views"]["open_deals"]["Row"][]
    >();
    const named = db.from("open_deals").select("id, amount").eq("name", "Acme");
    expectTypeOf<DataOf<typeof named>>().toEqualTypeOf<
      { id: string | null; amount: number | null }[]
    >();
    // @ts-expect-error a view has no such column
    db.from("open_deals").select("stage");
    // @ts-expect-error a view holds no foreign key, so it embeds nothing
    db.from("open_deals").select("id, companies(name)");
  });

  it("reads named and aliased columns, with whitespace and quoted names", () => {
    const query = db.from("deals").select(` id,
      title : name , "stage" `);
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<
      { id: string; title: string; stage: string }[]
    >();
  });

  it("refuses two items that read into one key, and allows a column next to *", () => {
    // @ts-expect-error two items read into "id"
    db.from("companies").select("id,id:name");
    // @ts-expect-error two items read into "id"
    db.from("companies").select("id, id");
    // @ts-expect-error the alias reads into "id", which * reads too
    db.from("companies").select("*, id:name");
    // @ts-expect-error the embed reads into "name", which the column reads too
    db.from("deals").select("name, name:companies(name)");
    // @ts-expect-error two items in the embed read into "name"
    db.from("deals").select("companies(name, name:domain)");
    expectTypeOf<SelectQuery<Database, "companies", "id,id:name">>().toEqualTypeOf<
      'the select reads more than one value into "id"'
    >();
    const starAndColumn = db.from("companies").select("*, id, deals(id)");
    expectTypeOf<DataOf<typeof starAndColumn>>().toEqualTypeOf<
      { domain: string | null; id: number; name: string; deals: { id: string }[] }[]
    >();
  });

  it("reads a many-to-one embed as a row or null", () => {
    const query = db.from("deals").select("name, companies(name, domain)");
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<
      { name: string; companies: { name: string; domain: string | null } | null }[]
    >();
  });

  it("reads a many-to-one embed on a required foreign key as a row or null", () => {
    const query = db.from("deal_notes").select("body, deals(name, amount)");
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<
      { body: string; deals: { name: string; amount: number } | null }[]
    >();
  });

  it("reads an !inner many-to-one embed as a row", () => {
    const query = db.from("deals").select("id, companies!inner(*)");
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<
      { id: string; companies: Company }[]
    >();
  });

  it("reads a one-to-many embed as a list", () => {
    const query = db.from("companies").select("name, deals(id, tags, details)");
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<
      { name: string; deals: { id: string; tags: string[]; details: Json | null }[] }[]
    >();
  });

  it("reads a reverse one-to-one embed as a row or null, and as a row with !inner", () => {
    const left = db.from("companies").select("id, company_profiles(summary)");
    expectTypeOf<DataOf<typeof left>>().toEqualTypeOf<
      { id: number; company_profiles: { summary: string | null } | null }[]
    >();
    const inner = db.from("companies").select("id, profile:company_profiles!inner(summary)");
    expectTypeOf<DataOf<typeof inner>>().toEqualTypeOf<
      { id: number; profile: { summary: string | null } }[]
    >();
  });

  it("reads a forward one-to-one embed as a row or null, and as a row with !inner", () => {
    const query = db.from("company_profiles").select("summary, companies(name)");
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<
      { summary: string | null; companies: { name: string } | null }[]
    >();
    const inner = db.from("company_profiles").select("summary, companies!inner(name)");
    expectTypeOf<DataOf<typeof inner>>().toEqualTypeOf<
      { summary: string | null; companies: { name: string } }[]
    >();
  });

  it("names an embed by alias, constraint, column and hint", () => {
    const byAlias = db.from("deals").select("company:companies(name)");
    expectTypeOf<DataOf<typeof byAlias>>().toEqualTypeOf<
      { company: { name: string } | null }[]
    >();
    const byConstraint = db.from("deals").select("id, deals_company_id_fkey(name)");
    expectTypeOf<DataOf<typeof byConstraint>>().toEqualTypeOf<
      { id: string; deals_company_id_fkey: { name: string } | null }[]
    >();
    const byColumn = db.from("deals").select("id, owner:company_id(name)");
    expectTypeOf<DataOf<typeof byColumn>>().toEqualTypeOf<
      { id: string; owner: { name: string } | null }[]
    >();
    const hinted = db
      .from("companies")
      .select("id, deals!deals_company_id_fkey!inner(id), notes:deals!company_id(name)");
    expectTypeOf<DataOf<typeof hinted>>().toEqualTypeOf<
      { id: number; deals: { id: string }[]; notes: { name: string }[] }[]
    >();
  });

  it("reads nested embeds", () => {
    const query = db
      .from("deal_notes")
      .select("id, deals(name, companies(name, company_profiles(summary)))");
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<
      {
        id: number;
        deals: {
          name: string;
          companies: { name: string; company_profiles: { summary: string | null } | null } | null;
        } | null;
      }[]
    >();
  });

  it("adds no key for an empty embed", () => {
    const query = db.from("deals").select("id, companies!inner()");
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<{ id: string }[]>();
  });

  it("answers one row with single", () => {
    const query = db.from("deals").select("id, name").eq("id", "d-1").single();
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<{ id: string; name: string }>();
  });

  it("answers the count beside the rows", () => {
    const query = db.from("deals").select("id", { count: "exact" });
    expectTypeOf<Awaited<typeof query>["count"]>().toEqualTypeOf<number | null>();
  });

  it("refuses a wrong table or a wrong name in a select", () => {
    // @ts-expect-error no such table
    db.from("dealz");
    // @ts-expect-error no such column
    db.from("deals").select("id, nme");
    // @ts-expect-error no such column inside an embed
    db.from("deals").select("id, companies(title)");
    // @ts-expect-error no foreign key relates the tables
    db.from("company_profiles").select("deals(id)");
    // @ts-expect-error the hint names no foreign key between the tables
    db.from("deals").select("companies!owner_id(name)");
    // @ts-expect-error an unclosed embed
    db.from("deals").select("id, companies(name");
    // @ts-expect-error a cast
    db.from("deals").select("amount::text");
  });

  it("resolves a bad select to the message Core answers", () => {
    expectTypeOf<SelectQuery<Database, "deals", "id, nme">>().toEqualTypeOf<
      'the table "deals" has no column "nme"'
    >();
    expectTypeOf<SelectQuery<Database, "deals", 'id, "na\\" me"'>>().toEqualTypeOf<
      'the table "deals" has no column "na" me"'
    >();
    expectTypeOf<
      SelectQuery<Database, "deal_notes", "deals(companies(company_profiles(companies(name))))">
    >().toEqualTypeOf<"embeds nest deeper than 3 levels">();
    expectTypeOf<SelectQuery<Database, "deals", "details->seats">>().toEqualTypeOf<
      "JSON paths are not supported"
    >();
    expectTypeOf<SelectQuery<Database, "deals", "id, ...companies(name)">>().toEqualTypeOf<
      "spreading an embedded table is not supported"
    >();
    expectTypeOf<SelectQuery<Database, "deals", "amount.median()">>().toEqualTypeOf<
      "only the aggregates avg(), count(), max(), min() and sum() are supported"
    >();
    expectTypeOf<SelectQuery<Database, "deals", "amount.sum">>().toEqualTypeOf<
      "only the aggregates avg(), count(), max(), min() and sum() are supported"
    >();
    expectTypeOf<SelectQuery<Database, "deals", "amount.sum()::int">>().toEqualTypeOf<
      "casts are not supported"
    >();
    expectTypeOf<SelectQuery<Database, "deals", "amount::text">>().toEqualTypeOf<
      "casts are not supported"
    >();
  });

  it("reads aggregates with the other columns as the group", () => {
    const grouped = db.from("deals").select("stage, total:amount.sum(), count()");
    expectTypeOf<DataOf<typeof grouped>>().toEqualTypeOf<
      { stage: string; total: number | null; count: number }[]
    >();
    const single = db
      .from("deals")
      .select("amount.avg(), lowest:amount.min(), latest:name.max(), named:name.count()");
    expectTypeOf<DataOf<typeof single>>().toEqualTypeOf<
      { avg: number | null; lowest: number | null; latest: string | null; named: number }[]
    >();
    const sameAlias = db.from("deals").select("amount:amount.sum()");
    expectTypeOf<DataOf<typeof sameAlias>>().toEqualTypeOf<{ amount: number | null }[]>();
    const quoted = db.from("deals").select('"amount".sum()');
    expectTypeOf<DataOf<typeof quoted>>().toEqualTypeOf<{ sum: number | null }[]>();
  });

  it("orders an aggregated select only by the columns that group it", () => {
    db.from("deals").select("stage, owner_id, count()").order("stage").order("owner_id");
    // @ts-expect-error an aggregated read orders only by a column it groups by
    db.from("deals").select("stage, count()").order("amount");
    // @ts-expect-error an aggregate without a group has no column to order by
    db.from("deals").select("count()").order("stage");
    db.from("deals").select("stage, amount").order("amount");
  });

  it("reads a quoted count() as an embed, as Core does", () => {
    expectTypeOf<SelectQuery<Database, "deals", '"count"()'>>().toEqualTypeOf<
      'no foreign key relates the tables "deals" and "count"'
    >();
    const counted = db.from("deals").select("count:count()");
    expectTypeOf<DataOf<typeof counted>>().toEqualTypeOf<{ count: number }[]>();
  });

  it("refuses an aggregate where Core refuses it", () => {
    // @ts-expect-error a sum reads a number column
    db.from("deals").select("name.sum()");
    // @ts-expect-error two aggregates read into "sum"
    db.from("deals").select("amount.sum(), id.sum()");
    expectTypeOf<SelectQuery<Database, "deals", "name.avg()">>().toEqualTypeOf<
      'avg() reads a number column, and "name" is not one'
    >();
    expectTypeOf<SelectQuery<Database, "deals", "details.max()">>().toEqualTypeOf<
      'max() cannot read the JSON column "details"'
    >();
    expectTypeOf<SelectQuery<Database, "deals", 'amount."sum"()'>>().toEqualTypeOf<
      "only the aggregates avg(), count(), max(), min() and sum() are supported"
    >();
    expectTypeOf<SelectQuery<Database, "deals", "nope.sum()">>().toEqualTypeOf<
      'the table "deals" has no column "nope"'
    >();
    expectTypeOf<SelectQuery<Database, "deals", "*, count()">>().toEqualTypeOf<
      "an aggregate cannot be read beside * or an embed"
    >();
    expectTypeOf<SelectQuery<Database, "deals", "count(), companies(name)">>().toEqualTypeOf<
      "an aggregate cannot be read beside * or an embed"
    >();
    expectTypeOf<SelectQuery<Database, "deals", "id, companies(count())">>().toEqualTypeOf<
      "an embed cannot read an aggregate"
    >();
    // @ts-expect-error a write cannot return an aggregate
    db.from("deals").delete().eq("id", "1").select("count()");
    // @ts-expect-error a write cannot return an aggregate
    db.from("companies").insert({ name: "Acme" }).select("id.sum()");
    // @ts-expect-error a write cannot return an aggregate
    db.from("companies").update({ name: "Acme" }).eq("id", 1).select("count()");
    expectTypeOf<WriteSelectQuery<Database, "deals", "count()">>().toEqualTypeOf<
      "a write cannot return an aggregate"
    >();
  });

  it("types every row as any without a Database type", () => {
    const untyped = createClient({ url: "u", key: "k", database: "d" });
    const query = untyped.from("anything").select("whatever, rel(x)").eq("nested.col", 1);
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<any[]>();
    const one = untyped.from("anything").select().single();
    expectTypeOf<DataOf<typeof one>>().toBeAny();
  });
});

describe("functions", () => {
  it("names each function with its arguments and its result", () => {
    expectTypeOf<FunctionName<Database>>().toEqualTypeOf<"deal_count">();
    expectTypeOf<FunctionArgs<Database, "deal_count">>().toEqualTypeOf<{ wanted: string }>();
    expectTypeOf<FunctionReturns<Database, "deal_count">>().toEqualTypeOf<number | null>();
    expectTypeOf<FunctionName<any>>().toEqualTypeOf<string>();
  });
});
