import { Effect, Option } from "effect";

export function loadModule<T>(
	path: string,
	returnDefault?: boolean,
): Effect.Effect<T> {
	console.log(`loadModule(${path})`);
	return Effect.promise(() =>
		import(`${process.cwd()}${path.startsWith("/") ? "" : "/"}${path}`).then(
			(mod) => {
				if (returnDefault) {
					return mod.default;
				}
				return mod;
			},
		),
	);
}

export function tryLoadModule<T>(path: string, returnDefault?: boolean) {
	console.log(`tryLoadModule(${path})`);
	return Effect.tryPromise({
		try: () =>
			import(`${process.cwd()}${path.startsWith("/") ? "" : "/"}${path}`).then(
				(mod) => {
					if (returnDefault) {
						return Option.some(mod.default as T);
					}
					return Option.some(mod as T);
				},
			),
		catch: () => Option.none(),
	});
}
