import { describe, expectTypeOf, it } from "vitest";

import { createClient } from "../../index";
import { type DataOf, db } from "./helpers";

/** Functions as `oaiz db types` writes them: no argument, an argument with a default, a set and void. */
type Functions = {
  data: {
    Tables: Record<string, never>;
    Functions: {
      task_count: { Args: Record<PropertyKey, never>; Returns: number | null };
      my_tasks: { Args: { p_limit?: number }; Returns: { id: number | null; title: string | null }[] };
      add_task: { Args: { p_title: string }; Returns: number | null };
      forget: { Args: { p_id: number }; Returns: null };
    };
  };
};

const client = createClient<Functions>({ url: "https://api.oaiz.test", key: "oai_server_key", database: "db-1" });

describe("rpc", () => {
  it("types the arguments and the result of each function", () => {
    expectTypeOf<DataOf<ReturnType<typeof db.rpc<"deal_count">>>>().toEqualTypeOf<number | null>();
    expectTypeOf<DataOf<ReturnType<typeof client.rpc<"my_tasks">>>>().toEqualTypeOf<{ id: number | null; title: string | null }[]>();
    expectTypeOf<DataOf<ReturnType<typeof client.rpc<"forget">>>>().toEqualTypeOf<null>();

    db.rpc("deal_count", { wanted: "open" });
    client.rpc("task_count");
    client.rpc("my_tasks");
    client.rpc("my_tasks", { p_limit: 5 });
    client.rpc("add_task", { p_title: "Draft the agenda" });
    client.database("db-2").rpc("task_count");
  });

  it("refuses an unknown function, an unknown argument and a missing or mistyped one", () => {
    // @ts-expect-error an unknown function
    client.rpc("task_total");
    // @ts-expect-error an argument the function does not take
    client.rpc("task_count", { p_owner: "u-1" });
    // @ts-expect-error an argument the function does not take
    client.rpc("my_tasks", { p_limit: 5, p_offset: 1 });
    // @ts-expect-error a required argument left out
    client.rpc("add_task");
    // @ts-expect-error a required argument left out
    client.rpc("add_task", {});
    // @ts-expect-error an argument of another type
    client.rpc("add_task", { p_title: 1 });
    // @ts-expect-error an argument of another type
    db.rpc("deal_count", { wanted: 1 });
  });

  it("takes no function and no view where `oaiz db types` writes empty blocks", () => {
    type NoSavedCode = {
      data: {
        Tables: {
          notes: { Row: { id: number }; Insert: { id?: number }; Update: { id?: number }; Relationships: [] };
        };
        Views: { [_ in never]: never };
        Functions: { [_ in never]: never };
      };
    };
    const tablesOnly = createClient<NoSavedCode>({ url: "https://api.oaiz.test", key: "oai_server_key", database: "db-1" });
    const read = tablesOnly.from("notes").select("id");
    expectTypeOf<DataOf<typeof read>>().toEqualTypeOf<{ id: number }[]>();
    // @ts-expect-error the database holds no function
    tablesOnly.rpc("task_count");
    // @ts-expect-error the database holds no view
    tablesOnly.from("open_notes");
  });

  it("takes any function and answers any without a Database type", () => {
    const untyped = createClient({ url: "https://api.oaiz.test", key: "oai_server_key", database: "db-1" });
    untyped.rpc("anything");
    untyped.rpc("anything", { whatever: 1 });
    expectTypeOf<DataOf<ReturnType<typeof untyped.rpc<"anything">>>>().toBeAny();
  });
});
