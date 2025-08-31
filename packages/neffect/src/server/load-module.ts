import { Effect, Option, SynchronizedRef } from "effect";

const ModuleCacheRef = SynchronizedRef.make(new Map<string, unknown>());

export function loadModule<T>(
	path: string,
	returnDefault?: boolean,
	cwd = process.cwd(),
): Effect.Effect<T> {
	return Effect.gen(function* () {
		const modulesCacheRef = yield* ModuleCacheRef;
		const moduleCache = yield* SynchronizedRef.get(modulesCacheRef);
		const cachedModule = moduleCache.get(path);

		if (cachedModule) {
			yield* Effect.log(`loadModule() -> returning cached for ${path} `);
			return cachedModule;
		}

		const module = yield* Effect.promise(() =>
			import(`${cwd}${path.startsWith("/") ? "" : "/"}${path}`).then((mod) =>
				returnDefault ? mod.default : mod,
			),
		);

		yield* SynchronizedRef.update(modulesCacheRef, (prev) => {
			prev.set(path, module);
			return prev;
		}).pipe(Effect.tap(() => Effect.log(`cached ${path}`)));

		yield* Effect.log(`loadModule(${path})`);
		return module;
	}).pipe(Effect.withSpan("loadModule"), Effect.annotateSpans({ path }));
}

export function tryLoadModule<T>(
	path: string,
	returnDefault?: boolean,
	cwd = process.cwd(),
): Effect.Effect<Option.Option<T>> {
	return Effect.gen(function* () {
		const modulesCacheRef = yield* ModuleCacheRef;
		const moduleCache = yield* SynchronizedRef.get(modulesCacheRef);
		const cachedModule = moduleCache.get(path);

		if (cachedModule) {
			yield* Effect.log(`tryLoadModule() -> returning cached for ${path} `);
			return Option.some(cachedModule as T);
		}

		const module = yield* Effect.promise(() =>
			import(`${cwd}${path.startsWith("/") ? "" : "/"}${path}`)
				.then((mod) =>
					returnDefault ? Option.some(mod.default as T) : Option.some(mod as T),
				)
				.catch(() => Option.none()),
		);

		if (module._tag === "Some") {
			yield* SynchronizedRef.update(modulesCacheRef, (prev) => {
				prev.set(path, module.value);
				return prev;
			});
		}

		yield* Effect.log(`tryLoadModule(${path})`);
		return module;
	}).pipe(Effect.withSpan("tryLoadModule"), Effect.annotateSpans({ path }));
}
