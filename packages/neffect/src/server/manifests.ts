import { Context, Effect, Layer } from "effect";
import { ProvidedBuildConfig } from "../app-config.ts";
import type { AssetChunk, Manifest, ManifestChunk } from "../types.ts";

export class ClientManifest extends Context.Tag("ClientManifest")<
	ClientManifest,
	Manifest
>() {}

export const getClientManifest = ProvidedBuildConfig.pipe(
	Effect.flatMap((buildConfig) =>
		Effect.promise(
			() =>
				import(`${process.cwd()}/${buildConfig.outDir}/client/manifest.json`, {
					with: { type: "json" },
				}).then((mod) => mod.default) as unknown as Promise<Manifest>,
		),
	),
);

export const ClientManifestLive = Layer.effect(
	ClientManifest,
	getClientManifest,
);

export class RouteManifest extends Context.Tag("RouteManifest")<
	RouteManifest,
	Manifest
>() {}

export class ServerManifest extends Context.Tag("ServerManifest")<
	ServerManifest,
	Manifest
>() {}

export const getServerManifest = ProvidedBuildConfig.pipe(
	Effect.flatMap((buildConfig) =>
		Effect.promise(
			() =>
				import(`${process.cwd()}/${buildConfig.outDir}/server/manifest.json`, {
					with: { type: "json" },
				}).then((mod) => mod.default) as unknown as Promise<Manifest>,
		),
	),
);

export const ServerManifestLive = Layer.effect(
	ServerManifest,
	getServerManifest,
);
export const getRouteManifest = Effect.gen(function* () {
	const serverManifest = yield* getServerManifest;
	const { routeDir } = yield* ProvidedBuildConfig;

	return Object.entries(serverManifest).reduce<
		Record<string, ManifestChunk | AssetChunk>
	>((acc, [key, value]) => {
		const routeKey = key
			.replace(routeDir, "")
			.split(".")[0]
			.replace(/_([^\]]+)_/g, ":$1")
			.replace("/index", "/");
		if (
			value.type === "chunk" &&
			key.startsWith(`${routeDir}/`) &&
			!key.includes("_app") &&
			!key.includes("_document")
		) {
			acc[routeKey] = {
				...value,
				pattern: new URLPattern({ pathname: routeKey }),
				pathPattern: routeKey,
			};
		}
		if (value.type === "asset") {
			acc[key.replace(`${routeDir}/`, "/")] = {
				...value,
				file: value.file,
			};
		}
		return acc;
	}, {});
});

export const RouteManifestLive = Layer.effect(RouteManifest, getRouteManifest);
