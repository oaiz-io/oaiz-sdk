import { createClient } from "../../index";
import type { Database } from "../fixtures/database";

export const db = createClient<Database>({
  url: "https://api.oaiz.test",
  key: "oai_server_key",
  database: "db-1",
});

/** The `data` of a request that succeeded. */
export type DataOf<Request> =
  Awaited<Request> extends infer Response
    ? Response extends { error: null; data: infer Data }
      ? Data
      : never
    : never;
