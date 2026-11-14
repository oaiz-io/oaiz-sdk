export type TextDiffLine = {
  type: 'equal' | 'insert' | 'delete';
  text: string;
};

export type TextDiffResult =
  | { status: 'too-large' }
  | { status: 'ready'; lines: TextDiffLine[]; added: number; removed: number };

export const TEXT_DIFF_LIMITS = {
  characters: 100_000,
  lines: 2_000,
  comparisons: 1_000_000,
} as const;

/** A bounded line comparison; callers render the explicit limit state. */
export function compareText(before: string, after: string): TextDiffResult {
  if (
    before.length > TEXT_DIFF_LIMITS.characters ||
    after.length > TEXT_DIFF_LIMITS.characters
  )
    return { status: 'too-large' };

  const left = before === '' ? [] : before.split('\n');
  const right = after === '' ? [] : after.split('\n');
  if (
    left.length > TEXT_DIFF_LIMITS.lines ||
    right.length > TEXT_DIFF_LIMITS.lines
  ) {
    return { status: 'too-large' };
  }
  let start = 0;
  while (
    start < left.length &&
    start < right.length &&
    left[start] === right[start]
  )
    start++;
  let leftEnd = left.length;
  let rightEnd = right.length;
  while (
    leftEnd > start &&
    rightEnd > start &&
    left[leftEnd - 1] === right[rightEnd - 1]
  ) {
    leftEnd--;
    rightEnd--;
  }
  const n = leftEnd - start;
  const m = rightEnd - start;
  if ((n + 1) * (m + 1) > TEXT_DIFF_LIMITS.comparisons)
    return { status: 'too-large' };

  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        left[start + i] === right[start + j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const lines: TextDiffLine[] = left
    .slice(0, start)
    .map((text) => ({ type: 'equal', text }));
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  while (i < n || j < m) {
    if (i < n && j < m && left[start + i] === right[start + j]) {
      lines.push({ type: 'equal', text: left[start + i++]! });
      j++;
    } else if (i < n && (j === m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      lines.push({ type: 'delete', text: left[start + i++]! });
      removed++;
    } else {
      lines.push({ type: 'insert', text: right[start + j++]! });
      added++;
    }
  }
  lines.push(
    ...left.slice(leftEnd).map((text) => ({ type: 'equal' as const, text })),
  );
  return { status: 'ready', lines, added, removed };
}

/** Keep three surrounding lines and explicitly mark every omitted range. */
export function compactTextDiff(
  lines: TextDiffLine[],
): (TextDiffLine | { type: 'gap'; count: number })[] {
  const changes = lines.flatMap((line, index) =>
    line.type === 'equal' ? [] : [index],
  );
  if (changes.length === 0) return lines;
  const visible = new Set<number>();
  for (const index of changes) {
    for (let offset = -3; offset <= 3; offset++) visible.add(index + offset);
  }
  const result: (TextDiffLine | { type: 'gap'; count: number })[] = [];
  let omitted = 0;
  for (let index = 0; index < lines.length; index++) {
    if (visible.has(index)) {
      if (omitted) result.push({ type: 'gap', count: omitted });
      omitted = 0;
      result.push(lines[index]!);
    } else omitted++;
  }
  if (omitted) result.push({ type: 'gap', count: omitted });
  return result;
}
