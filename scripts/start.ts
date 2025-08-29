import { FileSystem } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Option } from "effect";
import { build } from "rolldown";
import { type BuildConfig, defineConfig } from "../src/lib/plugin/rolldown.ts";
import { loadModule } from "../src/lib/server/load-module.ts";
import { server, warmUpServerImports } from "../src/lib/server/server.ts";

const main = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;

	const distExists = yield* fs.exists(`${process.cwd()}/dist`);

	if (!distExists) {
		yield* Effect.logInfo("No build detected. Building...");
		const providedBuildConfig =
			yield* loadModule<BuildConfig>("/app.config.ts");
		const configs = defineConfig(Option.getOrUndefined(providedBuildConfig));
		yield* Effect.promise(() => build(configs as never));
	}

	yield* warmUpServerImports;

	return yield* Layer.launch(server);
});

NodeRuntime.runMain(main.pipe(Effect.provide(NodeContext.layer)));
