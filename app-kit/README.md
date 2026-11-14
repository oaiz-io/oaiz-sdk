# @oaiz/app-kit

The components, hooks and theme that apps built on [OAIZ](https://oaiz.io) start from, as
source code. The kit is not a library to import: you copy an item's files into your app, and from
then on they are your code to change, replace or remove.

> **Not stable yet.** The package is versioned `0.x`. Any release can change, rename or remove an
> item, so note the version you copied from.

## Install

In a Vite and React 19 app:

```sh
npm install --save-dev @oaiz/app-kit
```

The package is only the source you copy from, so it is a development dependency, and nothing in
your app imports it. Every file is then under `node_modules/@oaiz/app-kit/`:

- `registry.json` lists every item in the [shadcn registry format](https://ui.shadcn.com/docs/registry):
  its files, the npm packages it imports (`dependencies`) and the other items it needs
  (`registryDependencies`, by item name).
- `src/` holds the files, at the paths `registry.json` names:

| File type | Folder | Holds |
|---|---|---|
| `registry:ui` | `src/components/ui/` | Primitives: button, dialog, select, table, toast and more |
| `registry:component` | `src/components/` | App building blocks: data table, record form, board, charts, chat panel |
| `registry:hook` | `src/hooks/` | Hooks, including the `@oaiz/sdk` data, session and chat hooks |
| `registry:lib` | `src/lib/` | `cn()` in `utils.ts` and small helpers |
| `registry:style` | `src/styles/oaiz/` | The OAIZ theme for Tailwind 4 |

## Add an item

The [OAIZ CLI](https://oaiz.io/docs/cli#install) adds items for you, and needs no sign-in to do it.
In your app's folder:

```sh
oaiz view kit init               # components.json, the utils and theme items, and Tailwind's import
oaiz view kit add button dialog  # these items and every item they need
oaiz view kit list               # every item, the items it needs and its npm packages
```

`kit add` writes each file where your `components.json` puts its type and installs the npm
packages the items import. The CLI downloads the items from the OAIZ API, not from this package.
Both carry the same items, but the API may serve a newer kit than the version you installed.

### Copy by hand

Without the CLI, copy the files from this package:

1. Find the item in `registry.json`. Copy its files, and those of every item its
   `registryDependencies` names (and theirs in turn), from `node_modules/@oaiz/app-kit/` to the
   same paths in your app. The files import each other by relative path, so keep the layout.
2. Install the item's `dependencies`. Each entry is an npm specifier such as `clsx@^2.1.1`, so
   pass it to `npm install` as written.

For example, the `button` item needs the `utils` item:

```sh
kit=node_modules/@oaiz/app-kit
mkdir -p src/lib src/components/ui
cp "$kit/src/lib/utils.ts" src/lib/
cp "$kit/src/components/ui/button.tsx" src/components/ui/
```

Then install the specifiers `registry.json` lists under `dependencies` for `utils` and `button`:

```sh
npm install clsx@^2.1.1 tailwind-merge@^3.7.0 @radix-ui/react-slot@^1.3.3 class-variance-authority@^0.7.1
```

The items also import `react` and `react-dom`. Components that read data use `@oaiz/sdk`;
install it beside the kit.

## Tailwind and the theme

Every item is styled with Tailwind 4 utilities and the OAIZ theme tokens, so the app needs:

- `tailwindcss` 4 with its Vite plugin, installed with
  `npm install --save-dev tailwindcss @tailwindcss/vite` and added to `vite.config.ts`:

  ```ts
  import tailwindcss from "@tailwindcss/vite";
  import react from "@vitejs/plugin-react";
  import { defineConfig } from "vite";

  export default defineConfig({ plugins: [react(), tailwindcss()] });
  ```

- the `utils` item (`src/lib/utils.ts`);
- the `theme` item: `src/styles/oaiz/tokens.css` with `scrollbars.css` and `voice-orb.css`,
  which it imports, and `app.css`. Copy all four to `src/styles/oaiz/` and install the theme's
  `dependencies` (`tw-animate-css`).

Your Tailwind stylesheet, such as `src/index.css`, imports Tailwind first, then the theme:

```css
@import "tailwindcss";
@import "./styles/oaiz/tokens.css";
@import "./styles/oaiz/app.css";
```

Dark mode follows a `dark` class on `<html>`.

### Your own palette

`tokens.css` gives every colour role a default value, with a neutral grey primary colour. The
`theme` item's `docs` in `registry.json` mention `app-theme.css`: that file belongs to the starter
OAIZ creates new apps from, and is not in this package. To set your own palette, write a stylesheet
that sets the `--role-*` values in both themes and import it after `app.css`:

```css
/* src/styles/app-theme.css */
:root {
  --role-primary: oklch(51.1% 0.262 276.966);
  --role-primary-foreground: oklch(1 0 0);
}

:root.dark {
  --role-primary: oklch(67.3% 0.182 276.935);
  --role-primary-foreground: oklch(12.9% 0.042 264.695);
}
```

```css
@import "./styles/app-theme.css";
```

`tokens.css` lists every `--role-*` value. Keep each surface paired with its text colour in both
themes.

### Fonts

The package holds no font files. The theme's `font-sans` is the device's system font stack. The
accordion uses `font-inter`, which names the Inter typeface first; install and load Inter yourself
if you want it, otherwise the browser falls back to the system fonts.

## Source and provenance

The source is in the `app-kit/` folder of [oaiz-io/oaiz-sdk](https://github.com/oaiz-io/oaiz-sdk).
Each release is published from there by the repository's publish workflow, with npm provenance;
run `npm audit signatures` in a project that installs the package to verify its signatures.

## Licence

MIT. Some files are adapted from [shadcn/ui](https://ui.shadcn.com), also under MIT;
`THIRD_PARTY_NOTICES.md` names them and holds that notice. Keep it with the files when you copy
them.
