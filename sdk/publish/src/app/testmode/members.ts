/** A team of the test organisation. */
export interface OaizTestTeam {
  id: string;
  name: string;
}

/** A member of the test organisation who can sign in to the app. */
export interface OaizTestMember {
  id: string;
  name: string;
  /** An address on `example.test`, never a real one. */
  email: string;
  /** The ids of the member's teams. */
  teams?: string[];
  /** The member's organisation role; `member` when omitted. */
  role?: "member" | "administrator";
}

/** The grant the app has on one database. */
export type OaizTestGrant = "view" | "edit";

/**
 * `tests/members.json`: who can sign in, and the app's grant on each database. A database the
 * grants leave out gets `edit`.
 */
export interface OaizTestMembers {
  teams: OaizTestTeam[];
  members: OaizTestMember[];
  grants: Record<string, OaizTestGrant>;
}

/** The grant a database the members file names no grant for gets. */
export const defaultGrant: OaizTestGrant = "edit";

/** Reads the members file's text; `what` names the file in every error. */
export function parseMembers(text: string, what: string): OaizTestMembers {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`${what} is not JSON: ${(error as Error).message}`, { cause: error });
  }
  const root = object(document, what, membersShape, ["teams", "members", "grants"]);
  const teams = array(root.teams ?? [], `${what} teams`).map((team, index) => {
    const fields = object(team, `${what} teams[${index}]`, teamShape, ["id", "name"]);
    return { id: nonEmpty(fields.id, `${what} teams[${index}].id`), name: nonEmpty(fields.name, `${what} teams[${index}].name`) };
  });
  const members = array(root.members ?? [], `${what} members`).map((member, index): OaizTestMember => {
    const where = `${what} members[${index}]`;
    const fields = object(member, where, memberShape, ["id", "name", "email", "teams", "role"]);
    const read: OaizTestMember = {
      id: nonEmpty(fields.id, `${where}.id`),
      name: nonEmpty(fields.name, `${where}.name`),
      email: nonEmpty(fields.email, `${where}.email`),
    };
    if (fields.teams !== undefined) {
      read.teams = array(fields.teams, `${where}.teams`).map((team, at) => nonEmpty(team, `${where}.teams[${at}]`));
    }
    if (fields.role !== undefined) {
      if (fields.role !== "member" && fields.role !== "administrator") {
        throw new Error(`${where}.role is "member" or "administrator"`);
      }
      read.role = fields.role;
    }
    return read;
  });
  const grants: Record<string, OaizTestGrant> = {};
  for (const [database, grant] of Object.entries(object(root.grants ?? {}, `${what} grants`, grantsShape))) {
    if (grant !== "view" && grant !== "edit") {
      throw new Error(`${what} grants.${database} is "view" or "edit"`);
    }
    grants[database.toLowerCase()] = grant;
  }
  return { teams, members, grants };
}

const teamShape = '{ "id": "<uuid>", "name": "Sales" }';
const memberShape =
  '{ "id": "<uuid>", "name": "Ada Lovelace", "email": "ada@example.test", "teams": ["<team uuid>"], "role": "member" }';
const grantsShape = '{ "<database-id>": "view" }';
const membersShape = `{ "teams": [${teamShape}], "members": [${memberShape}], "grants": ${grantsShape} }`;

/** shape is an example of the object, which the error shows. */
function object(value: unknown, what: string, shape: string, fields?: string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${what} is not an object such as ${shape}`);
  }
  for (const key of Object.keys(value)) {
    if (fields !== undefined && !fields.includes(key)) throw new Error(`${what} has the unknown field ${key}`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not an array`);
  return value;
}

function nonEmpty(value: unknown, what: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`${what} is not a text`);
  return value;
}
