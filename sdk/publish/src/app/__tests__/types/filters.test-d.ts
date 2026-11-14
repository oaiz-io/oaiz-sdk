import { describe, it } from "vitest";

import { db } from "./helpers";

describe("filters and order", () => {
  it("takes root columns with values typed from the row", () => {
    db.from("deals")
      .select("id")
      .eq("stage", "open")
      .neq("company_id", 1)
      .gt("amount", 10)
      .gte("amount", 10)
      .lt("amount", 10)
      .lte("amount", 10)
      .like("name", "Acme*")
      .ilike("name", "acme*")
      .in("stage", ["open", "won"] as const)
      .is("company_id", null)
      .is("details", true)
      .not("stage", "in", "(lost)")
      .or("stage.eq.open,amount.gt.10")
      .order("amount", { ascending: false, nullsFirst: true })
      .order("name")
      .limit(10)
      .range(0, 9);
  });

  it("takes embed columns of embeds in the select, by key or relation", () => {
    db.from("deals")
      .select("id, company:companies!inner(name, company_profiles())")
      .eq("company.name", "Acme")
      .eq("companies.domain", "acme.test")
      .is("company.company_profiles.summary", null);
  });

  it("takes a Postgres array column's value as its array literal, and Json values as given", () => {
    const query = db.from("deals").select("id");
    query
      .eq("tags", "{renewal}")
      .neq("tags", "{}")
      .in("tags", ["{a}", "{b,c}"])
      .eq("details", ["x"])
      .eq("details", { tier: "gold" });
    // @ts-expect-error an array column takes its Postgres array literal, not a list
    query.eq("tags", ["renewal"]);
    // @ts-expect-error an array column takes its Postgres array literal, not a list
    query.neq("tags", []);
    // @ts-expect-error in takes array literals for an array column
    query.in("tags", [["renewal"]]);
  });

  it("refuses wrong columns and values", () => {
    const query = db.from("deals").select("id, companies(name)");
    // @ts-expect-error no such column
    query.eq("stag", "open");
    // @ts-expect-error a number column takes a number
    query.eq("amount", "10");
    // @ts-expect-error eq takes no null; is does
    query.eq("company_id", null);
    // @ts-expect-error the embed has no such column
    query.eq("companies.title", "Acme");
    // @ts-expect-error deal_notes is not embedded in this select
    query.eq("deal_notes.body", "x");
    // @ts-expect-error in takes a list of the column's values
    query.in("amount", ["1"]);
    // @ts-expect-error is takes null or a boolean
    query.is("stage", "open");
    // @ts-expect-error an operator Core does not know
    query.not("stage", "between", "1");
    // @ts-expect-error order takes the table's own columns
    query.order("companies.name");
    // @ts-expect-error no such column
    query.order("nme");
  });
});
