#!/usr/bin/env node

import { FileSystem } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Option } from "effect";
import { type RolldownBuild, type RolldownOptions, rolldown } from "rolldown";
import { type BuildConfig, definePluginConfig } from "../plugin.ts";
import { loadModule } from "../server/load-module.ts";

interface BundleResult {
	path: string;
	size: string;
	compressed?: string | undefined;
}

export const main = Effect.gen(function* () {
	yield* Effect.logInfo("Building...");
	const fs = yield* FileSystem.FileSystem;
	const providedBuildConfig = yield* loadModule<BuildConfig>("/app.config.ts");

	const configs = definePluginConfig(
		Option.getOrUndefined(providedBuildConfig),
	);

	yield* Effect.all(
		["dist/server", "dist/client"].map((path) =>
			fs.makeDirectory(`${process.cwd()}/${path}`, {
				recursive: true,
			}),
		),
	);

	const builds = yield* Effect.all(
		configs.map((config) =>
			Effect.promise(() =>
				rolldown(config).then(
					(result) => [config, result] as [RolldownOptions, RolldownBuild],
				),
			),
		),
		{ concurrency: "unbounded" },
	);

	const [clientOutput, serverOutput] = yield* Effect.all(
		builds.map(([config, bundle]) => {
			const output = config.output;

			if (Array.isArray(output)) {
				return Effect.all(
					output.flatMap((output) =>
						Effect.promise(() => bundle.write(output)),
					),
					{ concurrency: "unbounded" },
				);
			}

			return Effect.promise(() => bundle.write(output).then((r) => r.output));
		}),
		{ concurrency: "unbounded" },
	);

	const clientResults: BundleResult[] = [];

	let totalJsSize = 0;
	let totalJsSizeCompressed = 0;
	for (const clientOutputElement of clientOutput) {
		if (!("fileName" in clientOutputElement)) {
			continue;
		}

		const fileSize = yield* fs
			.readFile(`${process.cwd()}/dist/client/${clientOutputElement.fileName}`)
			.pipe(
				Effect.map((buffer) => buffer.byteLength),
				Effect.map((byteLength) => byteLength / 1024),
				Effect.tap((size) => {
					if (clientOutputElement.fileName.endsWith(".js")) {
						totalJsSize += size;
					}
				}),
				Effect.map((size) => `${size.toFixed(2)}kb`),
			);

		let compressedSize: string | undefined;
		if (
			yield* fs.exists(
				`${process.cwd()}/dist/client/compressed/${clientOutputElement.fileName}`,
			)
		) {
			compressedSize = yield* fs
				.readFile(
					`${process.cwd()}/dist/client/compressed/${clientOutputElement.fileName}`,
				)
				.pipe(
					Effect.map((buffer) => buffer.byteLength),
					Effect.map((byteLength) => byteLength / 1024),
					Effect.tap((size) => {
						if (clientOutputElement.fileName.endsWith(".js")) {
							totalJsSizeCompressed += size;
						}
					}),
					Effect.map((size) => `${size.toFixed(2)}kb`),
				);
		}

		clientResults.push({
			path: `/dist/client/${clientOutputElement.fileName}`,
			size: fileSize,
			compressed: compressedSize,
		});
	}

	yield* Effect.logInfo(
		`Client result: ${totalJsSize.toFixed(2)}kb ${totalJsSizeCompressed ? `(compressed: ${totalJsSizeCompressed.toFixed(2)}kb)` : ""}`,
	);
	console.table(
		clientResults.sort(
			(a, b) => Number.parseFloat(b.size) - Number.parseFloat(a.size),
		),
	);

	const serverResults: BundleResult[] = [];

	for (const serverOutputElement of serverOutput) {
		if (!("fileName" in serverOutputElement)) {
			continue;
		}

		const fileSize = yield* fs
			.readFile(`${process.cwd()}/dist/server/${serverOutputElement.fileName}`)
			.pipe(
				Effect.map((buffer) => buffer.byteLength),
				Effect.map((byteLength) => `${(byteLength / 1024).toFixed(2)}kb`),
			);

		serverResults.push({
			path: `/dist/server/${serverOutputElement.fileName}`,
			size: fileSize,
		});
	}

	yield* Effect.logInfo("Server result:");

	console.table(
		serverResults.sort(
			(a, b) => Number.parseFloat(b.size) - Number.parseFloat(a.size),
		),
	);

	yield* Effect.logInfo("Build complete.");
}).pipe(Effect.provide(NodeContext.layer));

NodeRuntime.runMain(main);
