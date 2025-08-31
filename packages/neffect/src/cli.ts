#!/usr/bin/env node

import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { ProvidedBuildConfigLive } from "./app-config.ts";
import build from "./scripts/build.ts";
import dev from "./scripts/dev.ts";
import start from "./scripts/start.ts";
import { server } from "./server/server.ts";

const devCommand = Command.make("dev", {}, () =>
	build.pipe(
		Effect.andThen(() => Effect.forkDaemon(Layer.launch(server))),
		Effect.andThen(() => Effect.forkDaemon(dev)),
	),
).pipe(Command.withDescription("Neffect Dev Server"));

const buildCommand = Command.make("build", {}, () => build).pipe(
	Command.withDescription("Neffect Build"),
);
const startCommand = Command.make("start", {}, () => start).pipe(
	Command.withDescription("Neffect Production Server"),
);

const command = Command.make("neffect", {}, () =>
	Effect.gen(function* () {
		yield* Effect.logInfo("test");
	}),
).pipe(
	Command.withDescription("Neffect CLI"),
	Command.withSubcommands([devCommand, buildCommand, startCommand]),
);

const cli = Command.run(command, {
	name: "Neffect CLI",
	version: "0.1.0",
});

const MainLayer = Layer.mergeAll(NodeContext.layer);

cli(process.argv).pipe(
	Effect.provide(ProvidedBuildConfigLive),
	Effect.provide(MainLayer),
	Effect.tapErrorCause(Effect.logError),
	NodeRuntime.runMain,
);
