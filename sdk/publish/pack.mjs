// Writes the npm tarball of a published package, `@oaiz/sdk` or `@oaiz/app-kit`. The bytes depend
// only on the packed files: members in the given order, a folder's files sorted by path, mode 0644,
// owner 0, time 0, gzip level 9 and no operating system in the gzip header.
// The release and the publish workflow both pack with this file, so the tarball whose sha256
// `release.json` records is the tarball the publish workflow publishes.
//
//   node pack.mjs <tarball> <member>=<file or folder>...
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BLOCK = 512;

function files(member, path) {
  if (!statSync(path).isDirectory()) return [[member, path]];
  return readdirSync(path, { recursive: true })
    .filter((name) => statSync(join(path, name)).isFile())
    .sort()
    .map((name) => [`${member}/${name}`, join(path, name)]);
}

function field(header, offset, length, value) {
  const bytes = Buffer.from(value, "ascii");
  if (bytes.length > length) throw new Error(`pack: ${value} does not fit a tar header field`);
  bytes.copy(header, offset);
}

function octal(value, length) {
  return `${value.toString(8).padStart(length - 1, "0")}\0`;
}

function header(name, size) {
  if (!/^[\x21-\x7e]+$/.test(name)) throw new Error(`pack: ${name} is not a printable ASCII path`);
  let prefix = "";
  let base = name;
  if (name.length > 100) {
    const cut = name.lastIndexOf("/", 155);
    prefix = name.slice(0, cut);
    base = name.slice(cut + 1);
  }
  const block = Buffer.alloc(BLOCK);
  field(block, 0, 100, base);
  field(block, 100, 8, octal(0o644, 8));
  field(block, 108, 8, octal(0, 8));
  field(block, 116, 8, octal(0, 8));
  field(block, 124, 12, octal(size, 12));
  field(block, 136, 12, octal(0, 12));
  field(block, 148, 8, " ".repeat(8));
  field(block, 156, 1, "0");
  field(block, 257, 8, "ustar\x0000");
  field(block, 345, 155, prefix);
  const checksum = block.reduce((sum, byte) => sum + byte, 0);
  field(block, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return block;
}

const [tarball, ...members] = process.argv.slice(2);
if (!tarball || members.length === 0) throw new Error("usage: node pack.mjs <tarball> <member>=<file or folder>...");
const blocks = [];
for (const argument of members) {
  const separator = argument.indexOf("=");
  for (const [name, path] of files(argument.slice(0, separator), argument.slice(separator + 1))) {
    const body = readFileSync(path);
    blocks.push(header(name, body.length), body, Buffer.alloc((BLOCK - (body.length % BLOCK)) % BLOCK));
  }
}
blocks.push(Buffer.alloc(2 * BLOCK));
const gzipped = gzipSync(Buffer.concat(blocks), { level: 9 });
// The header's operating system byte follows the platform Node was built for.
gzipped[9] = 255;
writeFileSync(tarball, gzipped);
