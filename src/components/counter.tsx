import { useState } from "preact/compat";

function Counter({ initialCount = 0 }: { initialCount: number }) {
	const [count, setCount] = useState(initialCount);
	return (
		<div>
			<p>Count: {count}</p>
			<button type="button" onClick={() => setCount(count + 1)}>
				Increment
			</button>
		</div>
	);
}

export default Counter;
