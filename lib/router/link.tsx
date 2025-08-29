import type { AnchorHTMLAttributes } from "react";

import { useNavigation } from "./use-navigation.ts";

export function Link(props: AnchorHTMLAttributes) {
	const { handleClick } = useNavigation();

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: extending anchor for progressivly enhanced router
		<a
			{...props}
			data-router-link
			// biome-ignore lint/a11y/useValidAnchor: extending anchor for progressivly enhanced router
			onClick={handleClick}
		/>
	);
}
