import { Config } from "effect";

export const assetBaseUrlFallback = "/_assets/";

export const rootDirFallback = "src";

export const outDirFallback = "build";

export const publicDirFallback = "public";

export const routeDirFallback = "pages";

export const globalStylesheetFallback = "styles.css";

const nodeEnv = Config.string("NODE_ENV").pipe(
	Config.withDefault("development"),
);

export const isProduction = nodeEnv.pipe(
	Config.map((env) => env === "production"),
);

export const serverPortConfig = Config.port("PORT").pipe(
	Config.withDefault(3000),
);
