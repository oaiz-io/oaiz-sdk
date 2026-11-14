import { describe, expectTypeOf, it } from "vitest";

import type { Database } from "../fixtures/database";
import { type DataOf, db } from "./helpers";

describe("writes", () => {
  it("answers null without a select and the written rows with one", () => {
    const silent = db.from("deals").insert({ name: "Acme", owner_id: "u-1" });
    expectTypeOf<DataOf<typeof silent>>().toEqualTypeOf<null>();
    const many = db
      .from("deal_notes")
      .insert([{ deal_id: "d-1", body: "a" }, { deal_id: "d-1", body: "b", id: 9 }])
      .select("id, body_length");
    expectTypeOf<DataOf<typeof many>>().toEqualTypeOf<
      { id: number; body_length: number | null }[]
    >();
    const one = db
      .from("companies")
      .upsert({ name: "Acme", domain: "acme.test" }, { onConflict: "domain", ignoreDuplicates: true })
      .select("id, deals(id)")
      .single();
    expectTypeOf<DataOf<typeof one>>().toEqualTypeOf<{ id: number; deals: { id: string }[] }>();
    const updated = db.from("deals").update({ stage: "won" }, { count: "exact" }).eq("id", "d-1").select();
    expectTypeOf<DataOf<typeof updated>>().toEqualTypeOf<
      Database["data"]["Tables"]["deals"]["Row"][]
    >();
    const deleted = db.from("deals").delete().in("id", ["d-1"]);
    expectTypeOf<DataOf<typeof deleted>>().toEqualTypeOf<null>();
    const deletedOne = db.from("deals").delete().eq("id", "d-1").single();
    expectTypeOf<DataOf<typeof deletedOne>>().toEqualTypeOf<null>();
  });

  it("answers one row when single comes before the select", () => {
    const inserted = db.from("deals").insert({ name: "Acme", owner_id: "u-1" }).single().select("id");
    expectTypeOf<DataOf<typeof inserted>>().toEqualTypeOf<{ id: string }>();
    const updated = db.from("deals").update({ stage: "won" }).single().eq("id", "d-1").select("id");
    expectTypeOf<DataOf<typeof updated>>().toEqualTypeOf<{ id: string }>();
  });

  it("offers no order, limit or range on a write, and no filters on an insert or upsert", () => {
    const row = { name: "Acme", owner_id: "u-1" };
    // @ts-expect-error an insert takes no filters
    db.from("deals").insert(row).eq("id", "d-1");
    // @ts-expect-error an upsert takes no filters
    db.from("deals").upsert(row).select("id").or("id.eq.d-1");
    // @ts-expect-error an insert takes no order
    db.from("deals").insert(row).order("id");
    // @ts-expect-error an update takes no limit
    db.from("deals").update({ stage: "won" }).eq("id", "d-1").limit(1);
    // @ts-expect-error an update takes no order
    db.from("deals").update({ stage: "won" }).select("id").order("id");
    // @ts-expect-error a delete takes no range
    db.from("deals").delete().eq("id", "d-1").range(0, 0);
  });

  it("refuses every write to a view", () => {
    // @ts-expect-error a view takes no insert
    db.from("open_deals").insert({ name: "Acme" });
    // @ts-expect-error a view takes no upsert
    db.from("open_deals").upsert({ name: "Acme" });
    // @ts-expect-error a view takes no update
    db.from("open_deals").update({ name: "Acme" });
    // @ts-expect-error a view takes no delete
    db.from("open_deals").delete();
  });

  it("refuses wrong columns and values", () => {
    // @ts-expect-error no such column
    db.from("deals").insert({ name: "Acme", owner_id: "u-1", nme: "x" });
    // @ts-expect-error owner_id is required
    db.from("deals").insert({ name: "Acme" });
    // @ts-expect-error an identity-always column takes no value
    db.from("companies").insert({ id: 1, name: "Acme" });
    // @ts-expect-error a generated column takes no value
    db.from("deal_notes").insert({ deal_id: "d-1", body: "a", body_length: 1 });
    // @ts-expect-error no such column
    db.from("deals").upsert([{ name: "Acme", owner_id: "u-1", stag: "open" }]);
    // @ts-expect-error no such column
    db.from("deals").update({ stag: "won" });
    // @ts-expect-error a number column takes a number
    db.from("deals").update({ amount: "1" });
    // @ts-expect-error a write filters on the table's own columns
    db.from("deals").update({ stage: "won" }).eq("companies.name", "Acme");
    // @ts-expect-error no such column in the answered select
    db.from("deals").delete().eq("id", "d-1").select("nme");
  });
});
