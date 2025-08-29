#!/usr/bin/env node

import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Option } from "effect";
import { watch } from "rolldown";
import { type BuildConfig, definePluginConfig } from "../plugin.ts";
import { loadModule } from "../server/load-module.ts";
import { server } from "../server/server.ts";
import { build } from "./build.ts";

const dev = Effect.gen(function* () {
	yield* Effect.logInfo("Watching...");

	const providedBuildConfig = yield* loadModule<BuildConfig>("/app.config.ts");
	const configs = definePluginConfig(
		Option.getOrUndefined(providedBuildConfig),
	);

	yield* Effect.forkDaemon(Effect.sync(() => watch(configs)));
});

NodeRuntime.runMain(
	build
		.pipe(
			Effect.andThen(() => Effect.forkDaemon(Layer.launch(server))),
			Effect.andThen(() => Effect.forkDaemon(dev)),
		)
		.pipe(Effect.provide(NodeContext.layer)),
);
