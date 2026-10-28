import type { TransformFnParams } from 'class-transformer';

export function transformQueryBoolean({
  value,
  obj,
  key,
}: TransformFnParams): boolean | undefined {
  const source = obj as Record<string, unknown>;
  const raw = source[key] ?? value;
  if (raw === true || raw === 'true' || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === '0') return false;
  return undefined;
}
