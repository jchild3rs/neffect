import type { BuildConfig } from "neffect/plugin";

const isProd = process.env.NODE_ENV === "production";

const config: BuildConfig = {
	rootDir: ".",
	routeDir: "routes",
	minifyCss: isProd,
};

export default config;
