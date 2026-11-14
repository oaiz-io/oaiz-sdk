import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** An app's tests folder in a temporary directory, as the test mode reads it. */
export interface TestFolder {
  directory: string;
  /** Writes text at a path relative to the folder, such as `databases/<id>.sql`. */
  write(path: string, text: string): Promise<void>;
  remove(path: string): Promise<void>;
  dispose(): Promise<void>;
}

/** Makes a tests folder holding files, keyed by their path relative to the folder. */
export async function testFolder(files: Record<string, string> = {}): Promise<TestFolder> {
  const directory = await mkdtemp(join(tmpdir(), "oaiz-test-folder-"));
  const write = async (path: string, text: string) => {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), text);
  };
  for (const [path, text] of Object.entries(files)) await write(path, text);
  return {
    directory,
    write,
    remove: (path) => rm(join(directory, path), { force: true }),
    dispose: () => rm(directory, { recursive: true, force: true }),
  };
}
