import { describe, expect, it } from "vitest";

import { statementTimeoutError, statementTimeoutLimit } from "../../testmode/rows/errors";

describe("statement timeout refusal", () => {
  it("answers 503 and names the limit the test database sets", () => {
    const error = statementTimeoutError();

    expect(error.status).toBe(503);
    expect(error.slug).toBe("storage-statement-timeout");
    expect(error.message).toBe(
      `statement-timeout: the statement exceeded the statement timeout of ${statementTimeoutLimit}`,
    );
    expect(error.body()).toEqual({ message: error.message, slug: error.slug });
    expect(error.message).not.toContain("canceling statement");
  });
});
