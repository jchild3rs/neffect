import {
	FileSystem,
	HttpMiddleware,
	HttpServerRequest,
	HttpServerResponse,
} from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { PublicFilesMap } from "./public-files.ts";

export class StaticAssets extends Context.Tag("StaticAssets")<
	StaticAssets,
	Record<string, string>
>() {}

export const StaticAssetsLive = Layer.effect(
	StaticAssets,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const files = yield* fs.readDirectory(`${process.cwd()}/dist/client`, {
			recursive: true,
		});

		return files.reduce<Record<string, string>>((acc, file) => {
			const path = file.split("/").slice(1).join("/");
			acc[path] = file;
			return acc;
		}, {});
	}),
);

export const StaticAssetsMiddleware = HttpMiddleware.make((app) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const fs = yield* FileSystem.FileSystem;

		if (request.url.includes("/_assets/")) {
			const hasCompressed = yield* fs.exists(
				`${process.cwd()}/dist/client/compressed`,
			);
			const acceptEncoding = request.headers["accept-encoding"] || "";
			const responseHeaders: Record<string, string> = {};
			const isCompressed = hasCompressed && acceptEncoding.includes("zstd");
			const path = request.url.split("_assets/")[1];
			if (isCompressed) {
				responseHeaders["Content-Encoding"] = "zstd";

				return yield* HttpServerResponse.file(
					`${process.cwd()}/dist/client/${isCompressed ? "compressed/" : ""}${path}`,
					{ headers: responseHeaders },
				);
			}

			return yield* HttpServerResponse.file(
				`${process.cwd()}/dist/client/${path}`,
			);
		}

		const publicFilesMap = yield* PublicFilesMap;
		const pathParts = request.url.split("/").filter(Boolean);
		const lastPart = pathParts[pathParts.length - 1];

		if (publicFilesMap[lastPart]) {
			return yield* HttpServerResponse.file(
				`${process.cwd()}/dist/client/public/${lastPart}`,
			);
		}

		return yield* app;
	}),
);
