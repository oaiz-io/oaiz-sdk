import { describe, expectTypeOf, it } from "vitest";

import { createClient } from "../../index";
import type { SelectQuery } from "../../types";
import type { DataOf } from "./helpers";

type People = {
  data: {
    Tables: {
      people: {
        Row: { id: number; manager_id: number | null; name: string }
        Insert: { id?: number; manager_id?: number | null; name: string }
        Update: { id?: number; manager_id?: number | null; name?: string }
        Relationships: [
          {
            foreignKeyName: "people_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: { author_id: number; id: number; reviewer_id: number | null }
        Insert: { author_id: number; id?: number; reviewer_id?: number | null }
        Update: { author_id?: number; id?: number; reviewer_id?: number | null }
        Relationships: [
          {
            foreignKeyName: "tasks_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
    }
  }
};

const db = createClient<People>({ url: "u", key: "k", database: "d" });

describe("embeds with more than one foreign key", () => {
  it("refuses an ambiguous embed", () => {
    // @ts-expect-error two foreign keys relate tasks and people
    db.from("tasks").select("id, people(name)");
    // @ts-expect-error two foreign keys relate people and tasks
    db.from("people").select("id, tasks(id)");
    expectTypeOf<SelectQuery<People, "tasks", "id, people(name)">>().toEqualTypeOf<
      'more than one foreign key relates the tables "tasks" and "people"; name one with a hint'
    >();
  });

  it("resolves the embed by hint or column", () => {
    const query = db
      .from("tasks")
      .select("id, author:people!tasks_author_id_fkey(name), reviewer_id(name)");
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<
      { id: number; author: { name: string } | null; reviewer_id: { name: string } | null }[]
    >();
    const reverse = db.from("people").select("id, reviews:tasks!reviewer_id(id)");
    expectTypeOf<DataOf<typeof reverse>>().toEqualTypeOf<
      { id: number; reviews: { id: number }[] }[]
    >();
  });

  it("reaches the children of a self reference by table name and the parent by column", () => {
    const query = db
      .from("people")
      .select("name, reports:people(name), manager:manager_id(name)");
    expectTypeOf<DataOf<typeof query>>().toEqualTypeOf<
      { name: string; reports: { name: string }[]; manager: { name: string } | null }[]
    >();
  });
});
