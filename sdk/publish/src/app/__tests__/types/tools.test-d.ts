import { describe, expectTypeOf, it } from "vitest";

import type { DtoToolRunRequest, DtoToolRunResult } from "../../../models";
import { createClient, OaizTools, type OaizResponse } from "../../index";

describe("tools.run", () => {
  it("exports the facade and the generated result envelope on both client modes", () => {
    const app = createClient({ url: "https://api.oaiz.test", app: "app-1", database: "db-1" });
    const server = createClient({ url: "https://api.oaiz.test", key: "oai_server_key", database: "db-1" });
    const request: DtoToolRunRequest = {
      arguments: { databaseUuid: "db-1", sql: "SELECT * FROM notes" },
      executeIntegrationCommand: false,
      executeIntegrationQuery: true,
    };

    expectTypeOf(app.tools).toEqualTypeOf<OaizTools>();
    expectTypeOf(app.tools.run("storage_query", request)).toEqualTypeOf<Promise<OaizResponse<DtoToolRunResult>>>();
    expectTypeOf(app.database("db-2").tools).toEqualTypeOf<OaizTools>();
    expectTypeOf(server.tools.run("connection-id:action_type", request)).toEqualTypeOf<Promise<OaizResponse<DtoToolRunResult>>>();
  });

  it("requires object arguments and both explicit execution flags", () => {
    const client = createClient({ url: "https://api.oaiz.test", app: "app-1", database: "db-1" });
    // @ts-expect-error the request is required
    client.tools.run("storage_query");
    // @ts-expect-error execution flags are required
    client.tools.run("storage_query", { arguments: {} });
    // @ts-expect-error the command flag is required even for a query
    client.tools.run("storage_query", { arguments: {}, executeIntegrationQuery: true });
    // @ts-expect-error the query flag is required even for a command
    client.tools.run("connection-id:action_type", { arguments: {}, executeIntegrationCommand: true });
    // @ts-expect-error arguments are required
    client.tools.run("storage_query", { executeIntegrationCommand: false, executeIntegrationQuery: true });
    // @ts-expect-error arguments must be an object
    client.tools.run("storage_query", { arguments: "sql", executeIntegrationCommand: false, executeIntegrationQuery: true });
  });
});
