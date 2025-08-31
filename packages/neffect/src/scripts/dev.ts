import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { watch } from "rolldown";
import { ProvidedBuildConfig, ProvidedBuildConfigLive } from "../app-config.ts";
import { definePluginConfig } from "../plugin.ts";
import { server } from "../server/server.ts";
import { build } from "./build.ts";

const dev = Effect.gen(function* () {
	yield* Effect.logInfo("Watching...");

	const providedBuildConfig = yield* ProvidedBuildConfig;
	const configs = definePluginConfig(providedBuildConfig);

	yield* Effect.forkDaemon(Effect.sync(() => watch(configs)));
});

if (import.meta.main) {
	NodeRuntime.runMain(
		build
			.pipe(
				Effect.andThen(() => Effect.forkDaemon(Layer.launch(server))),
				Effect.andThen(() => Effect.forkDaemon(dev)),
			)
			.pipe(
				Effect.provide(ProvidedBuildConfigLive),
				Effect.provide(NodeContext.layer),
			),
	);
}

export default dev;
