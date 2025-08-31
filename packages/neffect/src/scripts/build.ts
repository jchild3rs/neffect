import { FileSystem } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { type RolldownBuild, type RolldownOptions, rolldown } from "rolldown";
import { ProvidedBuildConfig, ProvidedBuildConfigLive } from "../app-config.ts";
import { definePluginConfig } from "../plugin.ts";

interface BundleResult {
	path: string;
	size: string;
	compressed?: string | undefined;
}

export const build = Effect.gen(function* () {
	yield* Effect.logInfo("Building...");
	const fs = yield* FileSystem.FileSystem;
	const providedBuildConfig = yield* ProvidedBuildConfig;
	const { outDir } = providedBuildConfig;

	const outDirExists = yield* fs.exists(`${process.cwd()}/${outDir}`);
	if (outDirExists) {
		yield* fs.remove(`${process.cwd()}/${outDir}`, { recursive: true });
	}

	const configs = definePluginConfig(providedBuildConfig);

	yield* Effect.all(
		[`${outDir}/server`, `${outDir}/client`].map((path) =>
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
			.readFile(
				`${process.cwd()}/${outDir}/client/${clientOutputElement.fileName}`,
			)
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
				`${process.cwd()}/${outDir}/client/compressed/${clientOutputElement.fileName}`,
			)
		) {
			compressedSize = yield* fs
				.readFile(
					`${process.cwd()}/${outDir}/client/compressed/${clientOutputElement.fileName}`,
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
			path: `/${outDir}/client/${clientOutputElement.fileName}`,
			size: fileSize,
			compressed: compressedSize,
		});
	}

	if (import.meta.main) {
		yield* Effect.logInfo(
			`Client result: ${totalJsSize.toFixed(2)}kb ${totalJsSizeCompressed ? `(compressed: ${totalJsSizeCompressed.toFixed(2)}kb)` : ""}`,
		);
		console.table(
			clientResults.sort(
				(a, b) => Number.parseFloat(b.size) - Number.parseFloat(a.size),
			),
		);
	}

	const serverResults: BundleResult[] = [];

	for (const serverOutputElement of serverOutput) {
		if (!("fileName" in serverOutputElement)) {
			continue;
		}

		const fileSize = yield* fs
			.readFile(
				`${process.cwd()}/${outDir}/server/${serverOutputElement.fileName}`,
			)
			.pipe(
				Effect.map((buffer) => buffer.byteLength),
				Effect.map((byteLength) => `${(byteLength / 1024).toFixed(2)}kb`),
			);

		serverResults.push({
			path: `/${outDir}/server/${serverOutputElement.fileName}`,
			size: fileSize,
		});
	}

	if (import.meta.main) {
		yield* Effect.logInfo("Server result:");

		console.table(
			serverResults.sort(
				(a, b) => Number.parseFloat(b.size) - Number.parseFloat(a.size),
			),
		);
	}

	yield* Effect.logInfo("Build complete.");
});

if (import.meta.main) {
	NodeRuntime.runMain(
		build.pipe(
			Effect.provide(ProvidedBuildConfigLive),
			Effect.provide(NodeContext.layer),
		),
	);
}

export default build;
