import { describe, expectTypeOf, it } from "vitest";

import { createClient, type OaizAppClient, type OaizAuth, type OaizClient } from "../../index";

describe("createClient", () => {
  it("gives an app client auth on every database and a key client none", () => {
    const app = createClient({ url: "https://api.oaiz.test", app: "app-1", database: "db-1" });
    expectTypeOf(app).toEqualTypeOf<OaizAppClient<any>>();
    expectTypeOf(app.auth).toEqualTypeOf<OaizAuth>();
    expectTypeOf(app.database("db-2")).toEqualTypeOf<OaizAppClient<any>>();

    const server = createClient({ url: "https://api.oaiz.test", key: "oai_server_key", database: "db-1" });
    expectTypeOf(server).toEqualTypeOf<OaizClient<any>>();
    // @ts-expect-error a key client signs nobody in
    expectTypeOf(server.auth);
  });

  it("takes exactly one of key and app", () => {
    // @ts-expect-error key and app are exclusive
    createClient({ url: "https://api.oaiz.test", key: "oai_server_key", app: "app-1", database: "db-1" });
    // @ts-expect-error one of key and app is required
    createClient({ url: "https://api.oaiz.test", database: "db-1" });
  });
});
