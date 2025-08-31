import { FileSystem } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { ProvidedBuildConfigLive } from "../app-config.ts";
import { server, warmUpServerImports } from "../server/server.ts";
import { build } from "./build.ts";

const start = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;

	const hasBuild = yield* fs.exists(`${process.cwd()}/build`);
	if (!hasBuild) {
		yield* build;
	}

	yield* warmUpServerImports;

	return yield* Layer.launch(server);
});

if (import.meta.main) {
	BunRuntime.runMain(
		start.pipe(
			Effect.provide(ProvidedBuildConfigLive),
			Effect.provide(BunContext.layer),
		),
	);
}

export default start;
