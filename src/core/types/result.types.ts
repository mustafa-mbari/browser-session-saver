/**
 * result.types.ts — Discriminated union for typed error handling.
 *
 * Used in new code where a function can fail in expected ways.
 * Not retrofitted to existing functions.
 */

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
