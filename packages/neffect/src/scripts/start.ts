#!/usr/bin/env node

import { FileSystem } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
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
	NodeRuntime.runMain(start.pipe(Effect.provide(NodeContext.layer)));
}

export default start;
