// Utility type helpers shared across the codebase.

/**
 * Deeply readonly view of T (arrays become readonly arrays, objects recurse).
 *
 * The container checks match the *Readonly* forms deliberately. `Map<K, V>`
 * satisfies `ReadonlyMap<K, V>` but not the reverse -- a ReadonlyMap has no
 * set/delete/clear -- so testing `T extends Map<...>` silently missed any
 * already-readonly map and fell through to the object branch, which then
 * mapped over the map's *methods*. The result was a type shaped
 * `{ readonly get: {}; readonly has: {}; readonly size: number; ... }` that
 * nothing expecting a real map would accept. That single miss accounted for
 * 140 type errors across the permission-context plumbing.
 *
 * Functions are returned as-is for the same reason: mapping over a function's
 * keys yields `{}`, which is how every method on a passed-through container
 * became unusable.
 */
export type DeepImmutable<T> = T extends Primitive
  ? T
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T extends (...args: any[]) => unknown
    ? T
    : T extends ReadonlyArray<infer U>
      ? ReadonlyArray<DeepImmutable<U>>
      : T extends ReadonlyMap<infer K, infer V>
        ? ReadonlyMap<DeepImmutable<K>, DeepImmutable<V>>
        : T extends ReadonlySet<infer M>
          ? ReadonlySet<DeepImmutable<M>>
          : T extends object
            ? { readonly [K in keyof T]: DeepImmutable<T[K]> }
            : T

type Primitive = string | number | boolean | bigint | symbol | null | undefined

/** Make selected keys of T optional. */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/** Union of all values reachable from T's properties. */
export type DeepValues<T> = T extends object
  ? { [K in keyof T]: DeepValues<T[K]> }[keyof T]
  : T
