#!/usr/bin/env node

import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Option } from "effect";
import { watch } from "rolldown";
import { definePluginConfig } from "../plugin.ts";
import { server } from "../server/server.ts";
import { build, ProvidedBuildConfig } from "./build.ts";

const dev = Effect.gen(function* () {
	yield* Effect.logInfo("Watching...");

	const providedBuildConfig = yield* ProvidedBuildConfig;
	const configs = definePluginConfig(
		Option.getOrUndefined(providedBuildConfig),
	);

	yield* Effect.forkDaemon(Effect.sync(() => watch(configs)));
});

if (import.meta.main) {
	NodeRuntime.runMain(
		build
			.pipe(
				Effect.andThen(() => Effect.forkDaemon(Layer.launch(server))),
				Effect.andThen(() => Effect.forkDaemon(dev)),
			)
			.pipe(Effect.provide(NodeContext.layer)),
	);
}

export default dev;
