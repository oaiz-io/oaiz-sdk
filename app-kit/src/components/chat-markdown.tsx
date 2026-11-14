import { Table, TableHead, TableCell } from './ui/table';
import { Button } from './ui/button';
import { isValidElement, memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { cn } from '../lib/utils';
import { Heading } from './ui/heading';
import { Text } from './ui/text';
import { ScrollFade } from './ui/scroll-fade';
import { Separator } from './ui/separator';

const LINK_CLASS = 'text-primary hover:underline';
const PROMOTE_STABLE_TEXT_MS = 125;

/** Sets `copied` for two seconds after the text is on the clipboard; a refused write sets nothing. */
export function useCopy(): { copied: boolean; copy: (text: string) => Promise<void> } {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return {
    copied,
    copy: (text) =>
      navigator.clipboard.writeText(text).then(
        () => setCopied(true),
        () => undefined,
      ),
  };
}

function CodeBlock({ language, source }: { language: string; source: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="my-2 overflow-hidden rounded-lg" data-testid="chat-code-block">
      {language && (
        <div className="flex items-center justify-between bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
          <span>{language}</span>
          <Button variant="plain" size={null}
            type="button"
            // The pseudo-element makes the button 24px tall to a pointer or finger.
            className="relative flex items-center gap-1 transition-colors duration-fast ease-move after:absolute after:-inset-y-1 after:inset-x-0 hover:text-foreground"
            onClick={() => void copy(source)}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
      )}
      <pre tabIndex={0} className="m-0 overflow-x-auto bg-muted/40 p-inset font-mono text-xs leading-relaxed text-foreground">
        <code>{source}</code>
      </pre>
    </div>
  );
}

// A model-written image stays a link, so the browser asks for no address until the member clicks.
const MARKDOWN: Components = {
  h1: ({ children }) => (
    <Heading level={2} size="lg" className="mt-stack mb-2 first:mt-0">
      {children}
    </Heading>
  ),
  h2: ({ children }) => (
    <Heading level={2} size="md" className="mt-stack mb-2 first:mt-0">
      {children}
    </Heading>
  ),
  h3: ({ children }) => (
    <Heading level={3} size="sm" className="mt-stack mb-2 first:mt-0">
      {children}
    </Heading>
  ),
  h4: ({ children }) => (
    <Heading level={4} size="sm" className="mt-stack mb-2 first:mt-0">
      {children}
    </Heading>
  ),
  p: ({ children }) => (
    <Text as="p" leading="relaxed" className="my-2 first:mt-0 last:mb-0">
      {children}
    </Text>
  ),
  ul: ({ children }) => <ul className="my-2 list-disc pl-6 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal pl-6 text-sm">{children}</ol>,
  li: ({ children }) => (
    <li className="my-0.5 leading-relaxed text-foreground marker:text-muted-foreground">
      {children}
    </li>
  ),
  a: ({ children, href }) =>
    href ? (
      <a className={LINK_CLASS} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <>{children}</>
    ),
  img: ({ alt, src }) => (
    <a className={LINK_CLASS} href={src} target="_blank" rel="noopener noreferrer">
      {alt || src}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-inset text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <Separator decorative={false} className="my-4" />,
  pre: ({ children }) => {
    const code = isValidElement<{ children?: ReactNode; className?: string }>(children)
      ? children.props
      : {};
    return (
      <CodeBlock
        language={/language-(\w+)/.exec(code.className ?? '')?.[1] ?? ''}
        source={String(code.children ?? '').replace(/\n$/, '')}
      />
    );
  },
  code: ({ children }) => (
    <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-sm break-words text-foreground">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <ScrollFade className="my-2 rounded-lg border border-border" role="group" aria-label="Table" tabIndex={0}>
      <Table containerClassName="overflow-visible" className="w-full border-separate border-spacing-0 [&_tbody_tr:last-child_td]:border-b-0">
        {children}
      </Table>
    </ScrollFade>
  ),
  th: ({ children, style }) => (
    <Text asChild weight="medium">
      <TableHead
        style={style}
        className="whitespace-nowrap border-r border-b border-border bg-muted px-inset py-inline text-left last:border-r-0"
      >
        {children}
      </TableHead>
    </Text>
  ),
  td: ({ children, style }) => (
    <Text asChild>
      <TableCell style={style} className="border-r border-b border-border px-inset py-inline last:border-r-0 max-mobile:min-w-32">
        {children}
      </TableCell>
    </Text>
  ),
};

const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div data-testid="chat-markdown">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const STANDALONE_LINE = /^ {0,3}(?:#{1,6}(?:\s+|$)|(?:[-+*]|\d+[.)])\s+|>\s?)/;

/** Where the finished blocks end: blank lines, closed fences, and whole headings, list items and quotes. */
export function stableMarkdownEnd(markdown: string): number {
  let stable = 0;
  let at = 0;
  let fence: string | null = null;
  while (at < markdown.length) {
    const newline = markdown.indexOf('\n', at);
    const line = markdown.slice(at, newline < 0 ? markdown.length : newline);
    const end = newline < 0 ? markdown.length : newline + 1;
    const marker = FENCE.exec(line)?.[1];
    if (fence) {
      if (marker?.startsWith(fence[0]!) && marker.length >= fence.length && line.trim() === marker) {
        stable = end;
        fence = null;
      }
    } else if (marker) {
      fence = marker;
    } else if (newline < 0) {
      break;
    } else if (line.trim() === '' || STANDALONE_LINE.test(line)) {
      stable = end;
    }
    at = end;
  }
  return stable;
}

/** Finished blocks render as Markdown; the unfinished rest stays plain text, so half-written syntax never flickers. */
function StreamingMarkdown({ content }: { content: string }) {
  const stable = useMemo(() => stableMarkdownEnd(content), [content]);
  const [promoted, setPromoted] = useState(stable);
  const boundary = Math.min(promoted, stable);

  useEffect(() => {
    if (stable <= promoted) return;
    const timer = window.setTimeout(() => setPromoted(stable), PROMOTE_STABLE_TEXT_MS);
    return () => window.clearTimeout(timer);
  }, [promoted, stable]);

  const prefix = content.slice(0, boundary);
  const tail = content.slice(boundary);
  return (
    <>
      {prefix && <Markdown content={prefix} />}
      {tail && (
        <Text
          as="div"
          leading="relaxed"
          className={cn('break-words whitespace-pre-wrap', prefix && 'mt-2')}
        >
          {tail}
        </Text>
      )}
    </>
  );
}

export function ChatMarkdown({ content, streaming }: { content: string; streaming: boolean }) {
  return streaming ? <StreamingMarkdown content={content} /> : <Markdown content={content} />;
}
