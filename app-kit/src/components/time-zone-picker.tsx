import { useMemo } from 'react';
import { PropertyPicker, type PropertyPickerLabels } from './property-picker';

export type TimeZonePickerProps = {
  label: string;
  value: string | null;
  onChange: (timeZone: string) => void;
  disabled?: boolean;
  locale?: string;
  /** The instant whose offsets are displayed; defaults to the time the picker mounts. */
  at?: Date;
  /** Restricts the offered IANA zones, for example to an organization's locations. */
  zones?: readonly string[];
  labels?: Partial<PropertyPickerLabels>;
  className?: string;
};

/** Search IANA identifiers and their offset at an explicit instant. The caller owns the chosen zone. */
export function TimeZonePicker({
  label,
  value,
  onChange,
  disabled,
  locale,
  at,
  zones,
  labels,
  className,
}: TimeZonePickerProps) {
  const mountedAt = useMemo(() => new Date(), []);
  const instant = at ?? mountedAt;
  const options = useMemo(() => {
    const supported =
      zones ??
      (
        Intl as typeof Intl & {
          supportedValuesOf: (key: 'timeZone') => string[];
        }
      ).supportedValuesOf('timeZone');
    const identifiers = [
      ...new Set(['UTC', ...supported, ...(value ? [value] : [])]),
    ];
    return identifiers.map((zone) => {
      const offset = new Intl.DateTimeFormat(locale, {
        timeZone: zone,
        timeZoneName: 'shortOffset',
      })
        .formatToParts(instant)
        .find((part) => part.type === 'timeZoneName')?.value;
      return {
        value: zone,
        label: offset ? `${zone} (${offset})` : zone,
        keywords: [zone.replaceAll('_', ' ')],
      };
    });
  }, [zones, value, locale, instant]);
  return (
    <PropertyPicker
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      labels={labels}
      variant="row"
      className={className}
    />
  );
}
