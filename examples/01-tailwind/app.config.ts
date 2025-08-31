import tailwind from "@tailwindcss/postcss";
import type { BuildConfig } from "neffect/plugin";

const config: BuildConfig = {
	minifyCss: true,
	compress: true,
	postcssPlugins: [tailwind({ optimize: { minify: true } })],
};

export default config;
