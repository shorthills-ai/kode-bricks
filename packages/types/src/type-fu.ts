/**
 * TS
 */

export type Keys<T> = keyof T

export type Values<T> = T[keyof T]

export type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

export type AssertEqual<T extends true> = T

export function keysOf<T>() {
	return <const U extends readonly (keyof T)[]>(
		keys: keyof T extends U[number] ? (U[number] extends keyof T ? U : never) : never,
	): U => keys
}
