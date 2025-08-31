import type { BuildConfig } from "neffect/types";

const isProd = process.env.NODE_ENV === "production";

const config: BuildConfig = {
	assetBaseUrl: "/cdn/",
	globalStylesheet: "globals.css",
	minifyCss: isProd,
	publicDir: "static",
	rootDir: ".",
	routeDir: "routes",
};

export default config;
