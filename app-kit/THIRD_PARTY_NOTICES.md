# Third-party notices

OAIZ AB wrote the files of `@oaiz/app-kit` under the MIT licence in `LICENSE`, except the files
below, which are adapted from another project and keep that project's notice.

The package holds no fonts, images or icon files. The theme names the Inter typeface (`--font-inter`
in `src/styles/oaiz/tokens.css`, used by the accordion) and the device's system fonts, but bundles
neither: an app that wants Inter installs and loads it itself, and the browser falls back to system
fonts otherwise. The icons come from the `lucide-react` npm package, which the items import and the
app installs under its own licence.

## shadcn/ui

<https://github.com/shadcn-ui/ui>, MIT licence. These files are adapted from its `new-york`
components:

- `src/components/ui/accordion.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/collapsible.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/hover-card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/resizable.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/slider.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/toaster.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/use-toast.tsx`
- `src/lib/utils.ts`

`src/components/command-palette.tsx` carries the classes of its `command.tsx` component.

The semantic colour tokens in `src/styles/oaiz/tokens.css` (`background`, `foreground`, `primary`,
`muted` and the like) follow the shadcn/ui names, so that shadcn/ui components work with the theme.

```text
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
