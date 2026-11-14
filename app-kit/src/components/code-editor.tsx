import { useEffect, useRef } from 'react';
import {
  Annotation,
  Compartment,
  EditorState,
  Transaction,
} from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { PostgreSQL, sql, type SQLNamespace } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  lineNumbers,
  placeholder as editorPlaceholder,
} from '@codemirror/view';
import { cspNonce } from '../lib/csp-nonce';
import { cn } from '../lib/utils';

export type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  language?: 'python' | 'sql';
  readOnly?: boolean;
  placeholder?: string;
  height?: string;
  describedBy?: string;
  invalid?: boolean;
  onBlur?: () => void;
  /** Mod+Enter submits; Tab always moves to the next control. */
  onSubmit?: () => void;
  sqlSchema?: SQLNamespace;
  sqlDefaultSchema?: string;
  /** A one-based source location. */
  errorLocation?: { line: number; column: number } | null;
  className?: string;
};

const externalChange = Annotation.define<boolean>();
const errorMark = Decoration.mark({ class: 'cm-error-location' });
const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--color-code-key-text)' },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: 'var(--color-code-string-text)',
  },
  { tag: [tags.number, tags.bool], color: 'var(--color-code-number-text)' },
  { tag: tags.null, color: 'var(--color-code-null-text)' },
  {
    tag: [tags.punctuation, tags.operator],
    color: 'var(--color-code-punctuation-text)',
  },
  { tag: tags.comment, color: 'var(--color-muted-foreground)' },
]);
const theme = EditorView.theme({
  '&': {
    height: '100%',
    maxWidth: '100%',
    color: 'var(--color-code-foreground)',
    backgroundColor: 'var(--color-code-background)',
  },
  '&.cm-focused': {
    outline: '2px solid var(--color-ring)',
    outlineOffset: '2px',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-mono)',
    minWidth: '0',
  },
  '.cm-content': { caretColor: 'var(--color-foreground)', minHeight: '100%' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-foreground)' },
  '.cm-gutters': {
    color: 'var(--color-muted-foreground)',
    backgroundColor: 'var(--color-muted)',
    borderColor: 'var(--color-border)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--color-accent)',
  },
  '.cm-placeholder': { color: 'var(--color-muted-foreground)' },
  '.cm-error-location': {
    textDecoration: 'underline wavy var(--color-destructive-text)',
    textUnderlineOffset: '3px',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-popover)',
    color: 'var(--color-popover-foreground)',
    border: '1px solid var(--color-border)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-foreground)',
  },
});

function errorDecoration(
  state: EditorState,
  location: CodeEditorProps['errorLocation'],
) {
  if (
    !location ||
    !Number.isInteger(location.line) ||
    !Number.isInteger(location.column) ||
    location.line < 1 ||
    location.line > state.doc.lines ||
    location.column < 1
  )
    return [];
  const line = state.doc.line(location.line);
  const from = Math.min(line.from + location.column - 1, line.to);
  const word = /^[\w$."]+/.exec(state.doc.sliceString(from, line.to));
  const to = word ? from + word[0].length : Math.min(from + 1, line.to);
  const mark =
    to > from
      ? errorMark.range(from, to)
      : from > line.from
        ? errorMark.range(from - 1, from)
        : null;
  return mark ? EditorView.decorations.of(Decoration.set([mark])) : [];
}

/** A controlled code field. Completion uses Ctrl+Space and Enter; Tab leaves the editor. */
export function CodeEditor({
  value,
  onChange,
  label,
  language = 'python',
  readOnly = false,
  placeholder,
  height = '20rem',
  describedBy,
  invalid = false,
  onBlur,
  onSubmit,
  sqlSchema,
  sqlDefaultSchema,
  errorLocation,
  className,
}: CodeEditorProps) {
  const root = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onBlur, onSubmit });
  const initialValue = useRef(value);
  const configuration = useRef(new Compartment());
  const errors = useRef(new Compartment());

  useEffect(() => {
    callbacks.current = { onChange, onBlur, onSubmit };
  }, [onChange, onBlur, onSubmit]);

  useEffect(() => {
    if (!root.current) return;
    const view = new EditorView({
      parent: root.current,
      state: EditorState.create({
        doc: initialValue.current,
        extensions: [
          EditorView.cspNonce.of(cspNonce() ?? ''),
          lineNumbers(),
          drawSelection(),
          history(),
          autocompletion(),
          syntaxHighlighting(highlight),
          theme,
          keymap.of([
            {
              key: 'Mod-Enter',
              run: (editor) => {
                if (editor.state.readOnly || !callbacks.current.onSubmit)
                  return false;
                callbacks.current.onSubmit();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          configuration.current.of([]),
          errors.current.of([]),
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              !update.transactions.some((transaction) =>
                transaction.annotation(externalChange),
              )
            )
              callbacks.current.onChange(update.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            blur: () => {
              callbacks.current.onBlur?.();
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: configuration.current.reconfigure([
        language === 'python'
          ? python()
          : sql({
              dialect: PostgreSQL,
              schema: sqlSchema,
              defaultSchema: sqlDefaultSchema,
              upperCaseKeywords: true,
            }),
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({
          'aria-label': label,
          'aria-multiline': 'true',
          'aria-readonly': String(readOnly),
          'aria-invalid': String(invalid),
          ...(describedBy ? { 'aria-describedby': describedBy } : {}),
          tabindex: '0',
        }),
        ...(placeholder ? [editorPlaceholder(placeholder)] : []),
      ]),
    });
  }, [
    language,
    readOnly,
    label,
    describedBy,
    invalid,
    placeholder,
    sqlSchema,
    sqlDefaultSchema,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() !== value)
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        annotations: [
          externalChange.of(true),
          Transaction.addToHistory.of(false),
        ],
      });
    view.dispatch({
      effects: errors.current.reconfigure(
        errorDecoration(view.state, errorLocation),
      ),
    });
  }, [value, errorLocation]);

  return (
    <div
      ref={root}
      className={cn(
        'min-w-0 max-w-full rounded-md border border-input font-mono text-sm',
        className,
      )}
      style={{ height }}
    />
  );
}
