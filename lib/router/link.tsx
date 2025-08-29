import type { AnchorHTMLAttributes } from "react";

import { useNavigation } from "./use-navigation.ts";

export function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
	const { handleClick } = useNavigation();
	const { onClick, ...rest } = props;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: extending anchor for progressivly enhanced router
		<a
			{...rest}
			data-router-link
			// biome-ignore lint/a11y/useValidAnchor: extending anchor for progressivly enhanced router
			onClick={(e) => {
				onClick?.(e);
				// If user prevented default, respect it
				if (e.defaultPrevented) return;
				// Then let router handle it
				handleClick(e as unknown as MouseEvent);
			}}
		/>
	);
}
