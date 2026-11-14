# Contributing

Thank you for helping. Issues and contributions are welcome: a bug, a confusing example, a missing
feature or a fix. In an issue, include the package version, what you ran, what you expected and
what happened.

## Where the code comes from

The client and models in `sdk/publish/src/` (`apis/`, `models/`, `client.ts` and `errors.ts`) are
generated from the OAIZ API with [gnr8](https://github.com/oaiz-io/gnr8). Everything else
(`sdk/publish/src/index.ts`, the app client in `sdk/publish/src/app/`, the build files and
`app-kit/`) is written by hand. [`.gitattributes`](.gitattributes) marks the generated files, so
GitHub folds them in diffs.

## Pull requests

No pull request is merged here. This repository is a copy: every release replaces a package's
folder with a new snapshot of OAIZ's source, so a change merged here would be overwritten by the
next release.

A pull request is still useful. OAIZ makes a change to generated code in the generator, and ports
a change to hand-written code by hand into its repository, crediting you in the commit. The change
appears here with the next release, and the pull request is closed with a note that names that
release.

By opening a pull request you agree that your contribution is licensed under the
[MIT licence](LICENSE).

## How releases are made

OAIZ develops these packages in its own repository. Each release copies the source of a package
here as one commit, with the tag `<folder>-v<version>`. The tag starts
[the publish workflow](.github/workflows/publish.yaml), which builds the package from this source,
checks that the tarball is the one OAIZ recorded in `<folder>/release.json`, and publishes it to npm
with [provenance](https://docs.npmjs.com/generating-provenance-statements). The npm page of each
version links the workflow run that published it.

Rulesets let only OAIZ's release app change a branch or a tag here, and npm accepts a publish of
these packages only from the publish workflow or from an OAIZ owner signed in with two-factor
authentication.

To build a package yourself, install the Node.js version in `.node-version` and pnpm, then run in
its folder:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run --if-present build
pnpm run --if-present check
pnpm run --if-present test
pnpm run pack
```

A package published as source has no build, check or test. `pnpm run pack` writes the same tarball, byte
for byte, that npm serves for that version.

In `sdk/`, `pnpm test` runs the SDK's unit and type tests with vitest, then a smoke test of the
built package, and compiles every TypeScript example in both READMEs against it. Run it before you
open a pull request, and add or change a test with every change to the SDK's behaviour; the tests
are in `sdk/publish/src/app/__tests__/`. The [CI workflow](.github/workflows/ci.yaml) runs the
same commands on every pull request and every push to `main`, and the publish workflow runs them
again before it packs a release.

`app-kit/` has no tests here, because its folder installs no dependencies to compile the source
against; it is tested in OAIZ's repository before each release.

## Security

Do not report a vulnerability in an issue or a pull request. Email security@oaiz.io, as
[SECURITY.md](SECURITY.md) describes.
