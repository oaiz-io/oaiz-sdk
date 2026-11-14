import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Avatar, AvatarFallback } from './ui/avatar';

export type RecordNameProps = {
  name: string;
  /** A circle for a person, a square for a company or other thing. */
  round?: boolean;
  /** Compact inline mark or the Avatar primitive's default size. */
  size?: 'compact' | 'default';
  /** Muted text after the name, such as a job title. */
  detail?: ReactNode;
  className?: string;
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

const MARKS = [
  'bg-integration-icon-blue/15',
  'bg-integration-icon-emerald/15',
  'bg-integration-icon-amber/15',
  'bg-integration-icon-violet/15',
  'bg-integration-icon-coral/15',
  'bg-integration-icon-teal/15',
  'bg-integration-icon-indigo/15',
  'bg-integration-icon-rose/15',
];

function markOf(name: string): string {
  let sum = 0;
  for (const character of name) sum += character.codePointAt(0)!;
  return MARKS[sum % MARKS.length]!;
}

/** A small mark of a record's initials, coloured by its name, as the icon of a palette item or a card. */
export function RecordMark({
  name,
  round = false,
  size = 'compact',
}: Pick<RecordNameProps, 'name' | 'round' | 'size'>) {
  return (
    <Avatar
      aria-hidden="true"
      className={cn(size === 'compact' && 'size-5', !round && 'rounded-md')}
    >
      <AvatarFallback
        className={cn(
          'font-semibold text-foreground',
          size === 'compact' && 'text-2xs',
          markOf(name),
          !round && 'rounded-md',
        )}
      >
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** A record's name after its mark, so that a list scans by who or what it is. */
export function RecordName({
  name,
  round = false,
  size = 'compact',
  detail,
  className,
}: RecordNameProps) {
  return (
    <span className={cn('flex min-w-0 items-center gap-inline', className)}>
      <RecordMark name={name} round={round} size={size} />
      <span className="truncate font-medium">{name}</span>
      {detail && (
        <span className="truncate text-muted-foreground">{detail}</span>
      )}
    </span>
  );
}
