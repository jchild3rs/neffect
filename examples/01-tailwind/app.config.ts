import tailwind from "@tailwindcss/postcss";
import type { BuildConfig } from "neffect/plugin";

const isProd = process.env.NODE_ENV === "production";

const config: BuildConfig = {
	minifyCss: isProd,
	postcssPlugins: [tailwind({ optimize: { minify: isProd } })],
};

export default config;
