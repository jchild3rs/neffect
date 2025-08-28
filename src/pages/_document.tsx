import type { ProvidedDocumentProps } from "../lib/server/_document.tsx";

export default function Document(props: ProvidedDocumentProps) {
	return (
		<html lang="en">
			<head>{props.head}</head>
			<body>
				<div id="root" style="display: contents; isolation: isolate;">
					{props.body}
				</div>
				{props.scripts}
			</body>
		</html>
	);
}
