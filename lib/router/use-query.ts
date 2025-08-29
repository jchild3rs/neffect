import { useContext } from "react";
import { RouterContext } from "./router-context.tsx";

export function useQuery() {
	const context = useContext(RouterContext);

	if (!context) {
		throw new Error("useRoute must be used within a RouterContext.Provider");
	}

	return context.query;
}
