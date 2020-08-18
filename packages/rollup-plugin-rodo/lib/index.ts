import type { Plugin } from 'rollup';
import { generate, serialize } from '@intrnl/rodo';


export interface Options {
	prefix?: string,
	dir?: string,
	extensions?: string[],
}


export function rodo (opts: Options): Plugin {
	let { prefix = 'rodo:', dir, extensions } = opts;

	let pages_id = prefix + 'pages';

	return {
		name: 'rollup-plugin-rodo',
		resolveId (id) {
			if (id === pages_id) return id;
			return null;
		},
		async load (id) {
			if (id !== pages_id) return null;
			let metadata = await generate({ dir, extensions });
			return `export let routes = ${serialize(metadata)};`;
		}
	};
}
