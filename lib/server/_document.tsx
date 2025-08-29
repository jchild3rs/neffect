import type { PropsWithChildren, ReactElement } from "react";
import type { RouterContext } from "../router/router-context.tsx";
import type { Manifest, ManifestChunk } from "../types.ts";
import type { ImportMapJSON } from "./import-map.ts";

export interface DocumentProps {
	routeCssEntry?: ManifestChunk;
	routeManifest: Manifest;
	route: ManifestChunk;
	routeData?: unknown;
	routeContext: RouterContext;
	head: ReactElement | null;
	body: ReactElement | null;
	importMap: ImportMapJSON;
	nonce: string;
	hasProvidedApp: boolean;
}

export interface ProvidedDocumentProps {
	head: ReactElement | null;
	body: ReactElement | null;
	scripts: ReactElement | null;
}

export function DocumentHead(
	props: PropsWithChildren<{
		routeCssEntry?: ManifestChunk;
	}>,
) {
	return (
		<head>
			<meta charSet="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<link rel="stylesheet" href="/_assets/styles.css" />
			<link
				rel="stylesheet"
				id="route-css"
				href={
					props.routeCssEntry?.file
						? `/_assets/${props.routeCssEntry.file}`
						: undefined
				}
			/>
			{props.children}
		</head>
	);
}

export default function Document(props: DocumentProps) {
	return (
		<html lang="en">
			<DocumentHead routeCssEntry={props.routeCssEntry}>
				{props.head}
			</DocumentHead>
			<body>
				<div id="root" style="display: contents; isolation: isolate;">
					{props.body}
				</div>

				<DocumentScripts {...props} />
			</body>
		</html>
	);
}

export function DocumentScripts(props: DocumentProps) {
	return (
		<>
			<script
				nonce={props.nonce}
				type="application/json"
				id="route-data"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						routeContext: props.routeContext,
						fileImport: `/_assets/${props.route.file}`,
						cssImport: props.routeCssEntry
							? `/_assets/${props.routeCssEntry.file}`
							: null,
					}),
				}}
			></script>

			<script
				nonce={props.nonce}
				type="application/json"
				id="manifest"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(props.routeManifest),
				}}
			></script>

			<script
				nonce={props.nonce}
				type="application/json"
				id="load-result"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(props.routeData),
				}}
			></script>

			<script
				nonce={props.nonce}
				type="importmap"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(props.importMap) }}
			></script>

			<script nonce={props.nonce} type="module" src="/_assets/main.js"></script>

			<script
				nonce={props.nonce}
				dangerouslySetInnerHTML={{
					__html: `window.__hasProvidedApp = ${props.hasProvidedApp}`,
				}}
			></script>
		</>
	);
}
