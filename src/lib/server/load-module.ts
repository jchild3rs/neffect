import { Effect, Option } from "effect";

export const loadModule = <T>(
	path: `/${string}`,
): Effect.Effect<Option.Option<NonNullable<T>>> =>
	Effect.promise(() =>
		import(`${process.cwd()}${path}`).then((mod) => mod.default),
	).pipe(
		Effect.map((result) => (result ? Option.some(result) : Option.none())),
	);
