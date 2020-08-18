import * as path from 'upath';
import { generate, serialize } from '@intrnl/rodo';
import type { Plugin as VitePlugin, ServerPlugin } from 'vite';
import type { Plugin as RollupPlugin } from 'rollup';


export interface Options {
	prefix?: string,
	dir?: string,
	extensions?: string[],
}

export function rodo (opts: Options = {}): VitePlugin {
	let { prefix = '@rodo', dir, extensions } = opts;
	let namespace = `/${prefix}`;

	let passable_opts: PassableOptions = {
		namespace,
		dir,
		extensions,
	};

	return {
		rollupInputOptions: {
			plugins: [
				rollup(passable_opts),
			],
		},
		configureServer: [
			server(passable_opts),
		],
	};
}


interface PassableOptions {
	namespace: string,
	dir?: string,
	extensions?: string[],
}

function rollup (opts: PassableOptions): RollupPlugin {
	let { namespace, dir, extensions } = opts;

	return {
		name: 'vite-plugin:rodo',
		resolveId (id) {
			if (id === `${namespace}/pages`) return id;
			return null;
		},
		async load (id) {
			if (id !== `${namespace}/pages`) return null;

			let metadata = await generate({ dir, extensions });
			return `export let routes = ${serialize(metadata)}`;
		}
	};
}

function server (opts: PassableOptions): ServerPlugin {
	let { namespace, dir, extensions } = opts;

	let absolute_dir = path.resolve(dir);
	let absolute_re = new RegExp(escape_re(absolute_dir), 'g');

	return function handler ({ app, root }) {
		let relative_dir = path.relative(root, absolute_dir);
		let rewrite = `/${relative_dir}`;

		if (relative_dir.startsWith('..'))
			throw new Error(`Pages directory needs to be placed within the "root" directory: ${root}`);

		app.use(async (ctx, next) => {
			if (ctx.path === `${namespace}/pages`) {
				let metadata = await generate({ dir, extensions });
				let serialized = serialize(metadata).replace(absolute_re, rewrite);

				ctx.type = 'js';
				ctx.body = `export let routes = ${serialized};`;
				return;
			}

			return next();
		});
	};
}

function escape_re (str: string) {
	return str
		.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
		.replace(/-/g, '\\x2d');
}
