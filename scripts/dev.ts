import { NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Option } from "effect";
import { watch } from "rolldown";
import { type BuildConfig, defineConfig } from "../src/lib/plugin/rolldown.ts";
import { loadModule } from "../src/lib/server/load-module.ts";
import { server } from "../src/lib/server/server.ts";

const main = Effect.gen(function* () {
	yield* Effect.logInfo("Watching...");

	const providedBuildConfig = yield* loadModule<BuildConfig>("/app.config.ts");
	const configs = defineConfig(Option.getOrUndefined(providedBuildConfig));

	yield* Effect.forkDaemon(Effect.sync(() => watch(configs)));
});

NodeRuntime.runMain(main);
NodeRuntime.runMain(Layer.launch(server));
