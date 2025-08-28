import { Config } from "effect";

const nodeEnv = Config.string("NODE_ENV").pipe(
	Config.withDefault("development"),
);

export const isProduction = nodeEnv.pipe(
	Config.map((env) => env === "production"),
);

export const serverPortConfig = Config.port("PORT").pipe(
	Config.withDefault(3000),
);
