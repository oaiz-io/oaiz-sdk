import { describe, expect, it } from "vitest";

import { FilterParseError, condition, parseLogic } from "../../filters";

describe("parseLogic", () => {
  it.each([
    ["a.eq.1", [{ column: "a", operator: "eq", value: "1" }]],
    [
      "a.eq.1,b.neq.x",
      [
        { column: "a", operator: "eq", value: "1" },
        { column: "b", operator: "neq", value: "x" },
      ],
    ],
    ["a.not.eq.1", [{ column: "a", operator: "eq", value: "1", not: true }]],
    ["a.eq.", [{ column: "a", operator: "eq", value: "" }]],
    ["a.eq.1.5", [{ column: "a", operator: "eq", value: "1.5" }]],
    ["a.gte.2026-01-01T00:00:00Z", [{ column: "a", operator: "gte", value: "2026-01-01T00:00:00Z" }]],
    ["a.is.null", [{ column: "a", operator: "is", value: "null" }]],
    ["a.is.true", [{ column: "a", operator: "is", value: "true" }]],
    ["a.not.is.false", [{ column: "a", operator: "is", value: "false", not: true }]],
    ["a.like.*foo*", [{ column: "a", operator: "like", value: "%foo%" }]],
    ["a.ilike.A*", [{ column: "a", operator: "ilike", value: "A%" }]],
    ["a.in.(1,2,3)", [{ column: "a", operator: "in", values: ["1", "2", "3"] }]],
    ["a.in.()", [{ column: "a", operator: "in", values: [] }]],
    [
      'a.in.("x,y","say \\"hi\\")",z)',
      [{ column: "a", operator: "in", values: ["x,y", 'say "hi")', "z"] }],
    ],
    ["a.not.in.(1)", [{ column: "a", operator: "in", values: ["1"], not: true }]],
    ['a.eq."b,c)"', [{ column: "a", operator: "eq", value: "b,c)" }]],
    ['a.eq."back\\\\slash"', [{ column: "a", operator: "eq", value: "back\\slash" }]],
    ['a.like."*,*"', [{ column: "a", operator: "like", value: "%,%" }]],
    [
      "a.eq.1,and(b.gt.2,c.lt.3)",
      [
        { column: "a", operator: "eq", value: "1" },
        {
          and: [
            { column: "b", operator: "gt", value: "2" },
            { column: "c", operator: "lt", value: "3" },
          ],
        },
      ],
    ],
    [
      "not.and(a.eq.1,or(b.eq.2,not.or(c.eq.3,d.is.null)))",
      [
        {
          not: true,
          and: [
            { column: "a", operator: "eq", value: "1" },
            {
              or: [
                { column: "b", operator: "eq", value: "2" },
                {
                  not: true,
                  or: [
                    { column: "c", operator: "eq", value: "3" },
                    { column: "d", operator: "is", value: "null" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    ],
    ["not.eq.1", [{ column: "not", operator: "eq", value: "1" }]],
    [
      "a.eq.1, b.eq.2,\tand( c.eq.3)",
      [
        { column: "a", operator: "eq", value: "1" },
        { column: "b", operator: "eq", value: "2" },
        { and: [{ column: "c", operator: "eq", value: "3" }] },
      ],
    ],
    ['"first name".eq.x', [{ column: "first name", operator: "eq", value: "x" }]],
    ['"a.b\\"c".is.null', [{ column: 'a.b"c', operator: "is", value: "null" }]],
  ])("parses %s", (text, expected) => {
    expect(parseLogic(text)).toEqual(expected);
  });

  it.each([
    "",
    "a",
    "a.eq",
    ".eq.1",
    "a..1",
    "a.between.1",
    "a.not.between.1",
    "a.is.maybe",
    "a.in.1,2",
    "a.in.(1,2",
    'a.in.("x)',
    'a.eq."open',
    'a.eq."x"y',
    "and(a.eq.1",
    "and()",
    "a.eq.1)",
    "a.eq.1,",
    "or(a.eq.1)x",
    '"a.eq.1',
  ])("refuses %j", (text) => {
    expect(() => parseLogic(text)).toThrow(FilterParseError);
  });
});

describe("condition", () => {
  it("parses an in list and refuses one without parentheses", () => {
    expect(condition("a", "in", '(x,"y z")', true)).toEqual({
      column: "a",
      operator: "in",
      values: ["x", "y z"],
      not: true,
    });
    expect(() => condition("a", "in", "x,y", false)).toThrow(FilterParseError);
  });
});
