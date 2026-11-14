import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';
import { Avatar, AvatarImage } from './avatar';
import { Text } from './text';

export interface AvatarGroupPerson {
  name: string;
  /** A picture of the person; their initials show without it. */
  image?: string;
}

const avatarGroupVariants = cva('flex items-center', {
  variants: {
    size: {
      sm: '-space-x-1',
      md: '-space-x-1.5',
    },
  },
  defaultVariants: { size: 'md' },
});

/** Each size's avatar and the size of its initials, which a smaller avatar needs smaller. */
const AVATAR = { sm: 'size-6', md: 'size-8' } as const;
const INITIALS = { sm: '2xs', md: 'xs' } as const;

export interface AvatarGroupProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof avatarGroupVariants> {
  people: AvatarGroupPerson[];
  /** What the people are to the record, such as "Assignees"; it starts the group's accessible name. */
  label: string;
  /** The most avatars shown; the rest are counted as "+N". */
  max?: number;
}

function initials(name: string): string {
  const words = name.split(/[\s@.]+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

/**
 * Several people as overlapping avatars, such as a record's assignees or who it is shared with.
 * Past `max` the rest are counted. A screen reader hears the label and every name.
 */
const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ people, label, max = 4, size, className, ...props }, ref) => {
    const scale = size ?? 'md';
    const shown = people.slice(0, max);
    const hidden = people.length - shown.length;
    const names = people.map((person) => person.name).join(', ');
    return (
      <div
        ref={ref}
        role="img"
        aria-label={
          people.length === 0 ? `${label}: none` : `${label}: ${names}`
        }
        className={cn(avatarGroupVariants({ size }), className)}
        {...props}
      >
        {shown.map((person) => (
          <Avatar
            key={person.name}
            title={person.name}
            className={cn(AVATAR[scale], 'ring-2 ring-background')}
          >
            {person.image && <AvatarImage src={person.image} alt="" />}
            <AvatarPrimitive.Fallback asChild>
              <Text
                as="span"
                size={INITIALS[scale]}
                weight="medium"
                variant="muted"
                leading="none"
                className="flex size-full items-center justify-center rounded-full bg-muted"
              >
                {initials(person.name)}
              </Text>
            </AvatarPrimitive.Fallback>
          </Avatar>
        ))}
        {hidden > 0 && (
          <span
            title={people
              .slice(max)
              .map((person) => person.name)
              .join(', ')}
            className={cn(
              AVATAR[scale],
              'relative flex shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background',
            )}
          >
            <Text
              as="span"
              size={INITIALS[scale]}
              weight="medium"
              variant="muted"
              leading="none"
            >
              +{hidden}
            </Text>
          </span>
        )}
      </div>
    );
  },
);
AvatarGroup.displayName = 'AvatarGroup';

export { AvatarGroup, avatarGroupVariants };
