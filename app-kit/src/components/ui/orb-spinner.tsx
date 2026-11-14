import { useId } from 'react';
import { cn } from '../../lib/utils';

export interface OrbSpinnerProps {
  /** Rendered size in pixels of the square spinner. Defaults to 16. */
  sizePx?: number;
  /** Whether the orb rotates. Defaults to true. */
  spinning?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  'data-testid'?: string;
}

const PETAL_PATH =
  'M0 4.75A4.75 4.75 0 0 1 9.5 4.75V6.015Q9.5 8.015 7.5 8.015H2Q0 8.015 0 6.015Z';
const PETALS = [
  {
    gradient: 'blue-lime',
    transform: 'matrix(0.499998 0.866027 -0.866024 0.500002 15.2965 0)',
  },
  {
    gradient: 'green-gold',
    transform:
      'matrix(0.866025 -0.500001 0.499999 0.866026 0.000244141 8.83203)',
  },
  {
    gradient: 'blue-cream',
    transform: 'matrix(-0.866025 0.500001 -0.499999 -0.866026 24.053 15.168)',
  },
  {
    gradient: 'warm',
    transform: 'matrix(-0.499997 -0.866027 0.866024 -0.500003 8.75741 24)',
  },
];

/** A rotating four-petal gradient flower with rounded edges and a yellow centre. */
export function OrbSpinner({
  sizePx = 16,
  spinning = true,
  className,
  'aria-label': ariaLabel = 'Loading',
  'aria-hidden': ariaHidden,
  'data-testid': dataTestId,
}: OrbSpinnerProps) {
  const reactId = useId().replace(/:/g, '');
  const filterId = `orb-spinner-blur-${reactId}`;
  const trailFilterId = `orb-spinner-trail-${reactId}`;
  const centerFilterId = `orb-spinner-center-blur-${reactId}`;
  const gradientId = (name: string) => `orb-spinner-${name}-${reactId}`;
  const maskId = (edge: string) => `orb-spinner-${edge}-mask-${reactId}`;
  const isHidden = ariaHidden === true || ariaHidden === 'true';

  return (
    <span
      role={isHidden ? undefined : 'status'}
      aria-label={isHidden ? undefined : ariaLabel}
      aria-hidden={ariaHidden}
      data-testid={dataTestId}
      className={cn('inline-block shrink-0', className)}
      style={{ width: sizePx, height: sizePx }}
    >
      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 29 29"
        fill="none"
        className={cn(
          'block overflow-visible',
          spinning && 'motion-safe:animate-spin',
        )}
        style={{
          animationDuration: '2s',
          animationTimingFunction: 'var(--ease-move)',
        }}
        aria-hidden="true"
      >
        <defs>
          <filter
            id={filterId}
            x="-35%"
            y="-35%"
            width="170%"
            height="170%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="0.75" />
            <feComposite in2="SourceGraphic" operator="atop" />
          </filter>
          <filter
            id={trailFilterId}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="1.1 0.85" />
            <feOffset dx="-0.4" />
          </filter>
          {/* Local negative x trails each petal's clockwise movement. */}
          <linearGradient
            id={gradientId('trailing-alpha')}
            x1="0"
            x2="9.5"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.45" stopOpacity="1" />
            <stop offset="0.85" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id={gradientId('leading-alpha')}
            x1="0"
            x2="9.5"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.2" stopOpacity="0" />
            <stop offset="0.7" stopOpacity="1" />
          </linearGradient>
          {['trailing', 'leading'].map((edge) => (
            <mask
              key={edge}
              id={maskId(edge)}
              maskUnits="userSpaceOnUse"
              x="-5"
              y="-5"
              width="20"
              height="18"
              style={{ maskType: 'alpha' }}
            >
              <rect
                x="-5"
                y="-5"
                width="20"
                height="18"
                fill={`url(#${gradientId(`${edge}-alpha`)})`}
              />
            </mask>
          ))}
          <filter
            id={centerFilterId}
            x="-35%"
            y="-35%"
            width="170%"
            height="170%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="0.35" />
            <feComposite in2="SourceGraphic" operator="atop" />
          </filter>
          <linearGradient
            id={gradientId('blue-lime')}
            x1="9.5"
            y1="4"
            x2="0"
            y2="4"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--role-orb-blue)" />
            <stop offset="1" stopColor="var(--role-orb-lime)" />
          </linearGradient>
          <linearGradient
            id={gradientId('green-gold')}
            x1="4.824"
            y1="0"
            x2="4.824"
            y2="8.015"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--role-orb-green)" />
            <stop offset="0.293269" stopColor="var(--role-orb-lime-bright)" />
            <stop offset="0.605769" stopColor="var(--role-orb-gold)" />
          </linearGradient>
          <linearGradient
            id={gradientId('blue-cream')}
            x1="4.824"
            y1="8.015"
            x2="4.824"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--role-orb-blue-muted)" />
            <stop offset="1" stopColor="var(--role-orb-cream)" />
          </linearGradient>
          <radialGradient
            id={gradientId('warm')}
            cx="4.75"
            cy="4"
            r="5"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--role-orb-red)" />
            <stop offset="0.25" stopColor="var(--role-orb-orange)" />
            <stop offset="1" stopColor="var(--role-orb-amber)" />
          </radialGradient>
          <radialGradient
            id={gradientId('center')}
            cx="12.026"
            cy="12"
            r="4"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--role-orb-center-light)" />
            <stop offset="1" stopColor="var(--role-orb-center)" />
          </radialGradient>
        </defs>

        <g transform="translate(2.474 2.5)">
          {PETALS.map(({ gradient, transform }) => (
            <g key={gradient} transform={transform}>
              {spinning && (
                <path
                  d={PETAL_PATH}
                  fill={`url(#${gradientId(gradient)})`}
                  filter={`url(#${trailFilterId})`}
                  mask={`url(#${maskId('trailing')})`}
                />
              )}
              <path
                d={PETAL_PATH}
                fill={`url(#${gradientId(gradient)})`}
                filter={`url(#${filterId})`}
                mask={spinning ? `url(#${maskId('leading')})` : undefined}
              />
            </g>
          ))}
          <circle
            cx="12.026"
            cy="12"
            r="4"
            fill={`url(#${gradientId('center')})`}
            filter={`url(#${centerFilterId})`}
          />
        </g>
      </svg>
    </span>
  );
}
