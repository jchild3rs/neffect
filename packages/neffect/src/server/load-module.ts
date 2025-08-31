import { Effect, Option } from "effect";

export function loadModule<T>(
	path: string,
	returnDefault?: boolean,
	cwd = process.cwd(),
): Effect.Effect<T> {
	return Effect.promise(() =>
		import(`${cwd}${path.startsWith("/") ? "" : "/"}${path}`).then((mod) =>
			returnDefault ? mod.default : mod,
		),
	).pipe(Effect.withSpan("loadModule"), Effect.annotateSpans({ path }));
}

export function tryLoadModule<T>(
	path: string,
	returnDefault?: boolean,
	cwd = process.cwd(),
): Effect.Effect<Option.Option<T>> {
	return Effect.promise(() =>
		import(`${cwd}${path.startsWith("/") ? "" : "/"}${path}`)
			.then((mod) =>
				returnDefault ? Option.some(mod.default as T) : Option.some(mod as T),
			)
			.catch(() => Option.none()),
	).pipe(Effect.withSpan("tryLoadModule"), Effect.annotateSpans({ path }));
}
