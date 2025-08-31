import { type HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Stream } from "effect";
import { renderToReadableStream } from "preact-render-to-string/stream";
import type { ReactElement } from "react";
import { DOCTYPE_HTML_CHUNK } from "./server/constants.tsx";
import type { BuildConfig } from "./types.ts";

type RootDocumentProps = {
	head: ReactElement | null;
	body: ReactElement;
	buildConfig: BuildConfig;
	request: HttpServerRequest.HttpServerRequest;
	params: Record<string, string | undefined>;
};

export default function RootDocument(props: RootDocumentProps) {
	return (
		<html lang="en">
			<head>
				{props.head}
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<link rel="icon" href="/favicon.ico" />
				<link
					rel="stylesheet"
					href={`${props.buildConfig.assetBaseUrl}${props.buildConfig.globalStylesheet}`}
				/>
			</head>
			<body>
				<div id="root" style="display: contents; isolation: isolate;">
					{props.body}
				</div>
			</body>
		</html>
	);
}

export function HttpJSXServerResponse(props: RootDocumentProps) {
	return HttpServerResponse.stream(
		Stream.concat(
			Stream.fromChunk(DOCTYPE_HTML_CHUNK),
			Stream.fromReadableStream({
				evaluate: () => renderToReadableStream(<RootDocument {...props} />),
				onError: console.error,
			}),
		),
		{ contentType: "text/html" },
	);
}
