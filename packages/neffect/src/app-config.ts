import { Context, Effect, Layer } from "effect";
import {
	assetBaseUrlFallback,
	globalStylesheetFallback,
	outDirFallback,
	publicDirFallback,
	rootDirFallback,
	routeDirFallback,
} from "./server/config.ts";
import { tryLoadModule } from "./server/load-module.ts";
import type { BuildConfig } from "./types.ts";

export class ProvidedBuildConfig extends Context.Tag("ProvidedBuildConfig")<
	ProvidedBuildConfig,
	BuildConfig & {
		assetBaseUrl: string;
		rootDir: string;
		outDir: string;
		publicDir: string;
		routeDir: string;
	}
>() {}

export const getAppBuildConfig = tryLoadModule<BuildConfig>(
	"/app.config.ts",
	true,
).pipe(
	Effect.map((maybeConfig) => {
		const config = maybeConfig._tag === "Some" ? maybeConfig.value : {};

		return {
			...config,
			assetBaseUrl: config.assetBaseUrl ?? assetBaseUrlFallback,
			outDir: config.outDir ?? outDirFallback,
			publicDir: config.publicDir ?? publicDirFallback,
			rootDir: config.rootDir ?? rootDirFallback,
			routeDir: config.routeDir ?? routeDirFallback,
			globalStylesheet: config.globalStylesheet ?? globalStylesheetFallback,
		} satisfies BuildConfig;
	}),
);

export const ProvidedBuildConfigLive = Layer.effect(
	ProvidedBuildConfig,
	getAppBuildConfig,
);
