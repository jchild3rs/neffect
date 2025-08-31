import type { RolldownOptions } from "rolldown";

const config: RolldownOptions = {
	platform: "node",
	input: {
		link: "./src/router/link.tsx",
		server: "./src/server/server.ts",
		cli: "./src/cli.ts",
		document: "./src/server/_document.tsx",
		app: "./src/server/_app.tsx",
		plugin: "./src/plugin.ts",
	},
	output: {
		dir: "build/esm",
		format: "esm",
	},
	resolve: {
		alias: {
			react: "preact/compat",
			"react-dom/test-utils": "preact/test-utils",
			"react-dom": "preact/compat",
			"react/jsx-runtime": "preact/jsx-runtime",
		},
	},
};

export default config;
