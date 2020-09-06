import fs from 'fs/promises';
import * as path from 'upath';
import { escape_re, serialize_raw, is_plain_obj } from './utils';


let DYNAMIC_RE = /^\[(.+)\]$/;
let CATCH_ALL_RE = /^\[\.{3}(.+)\]$/;


export interface GenerateOptions {
	dir?: string,
	extensions?: string[],
}

export interface RouteProp {
	path: string,
	element?: string,
	children: RouteProp[],
}


export async function generate (opts: GenerateOptions = {}) {
	let { dir = 'pages/', extensions = ['.js'] } = opts;
	dir = path.resolve(dir);

	let routes = await build_routes(dir, extensions);
	return routes;
}

export function serialize (route: RouteProp[]) {
	return serialize_raw(route, (key, value) => {
		if (!is_plain_obj(value)) return value;

		let { path, element, children } = value;
		return {
			path: `"${path}"`,
			element: element
				? `() => import("${element}")`
				: undefined,
			children,
		};
	});
}


async function build_routes (cwd: string, exts: string[]) {
	let exts_re = new RegExp(`(${exts.map((ext) => escape_re(ext)).join('|')})$`);
	let layout_re = new RegExp(`^_layout(${exts.map((ext) => escape_re(ext)).join('|')})$`);
	let reset_re = new RegExp(`^_reset(${exts.map((ext) => escape_re(ext)).join('|')})$`);
	let index_re = /^index$/;

	let base: RouteProp = {
		path: '',
		element: '',
		children: [],
	};

	let root: RouteProp[] = [base];

	async function walk (
		dir: string,
		current: RouteProp,
		segment = '',
		parent?: RouteProp
	) {
		let entries = await fs.readdir(dir, { withFileTypes: true });

		let layout = entries.find((e) => layout_re.test(e.name));
		let reset = entries.find((e) => reset_re.test(e.name));

		if (layout && reset)
			throw new Error(`Cannot have both _layout and _reset file: ${dir}`);
		if (reset && !segment)
			throw new Error(`Base pages directory cannot have _reset`);

		if (layout) {
			let filename = path.join(dir, layout.name);

			if (!layout.isFile())
				throw new Error(`Expected _layout to be a file: ${filename}`);

			current.element = filename;
		}

		if (reset) {
			let filename = path.join(dir, reset.name);

			if (!reset.isFile())
				throw new Error(`Expected _reset to be a file: ${filename}`);

			current.element = filename;
			current.path = segment;
			root.push(current);
		} else if (parent) {
			parent.children.push(current);
		}

		for (let entry of entries) {
			if (entry.name[0] === '_') continue;

			let fullpath = path.join(dir, entry.name);
			let route: RouteProp = {
				path: '',
				element: '',
				children: [],
			};

			if (entry.isFile()) {
				let name = get_path(entry.name.replace(exts_re, '').replace(index_re, ''));

				if (current.children.find((r) => r.path === name))
					throw new Error(`Duplicate entry: ${fullpath}`);

				route.path = name;
				route.element = fullpath;
				current.children.push(route);
			} else if (entry.isDirectory()) {
				let name = get_path(entry.name);

				if (current.children.find((r) => r.path === name))
					throw new Error(`Duplicate entry: ${fullpath}`);

				route.path = name;
				await walk(fullpath, route, `${current.path}${current.path ? '/' : ''}${name}`, current);
			}
		}
	}

	await walk(cwd, base);
	sort_routes(root);

	return root;
}

function get_path (name: string) {
	let catch_all = CATCH_ALL_RE.exec(name);
	let dynamic = DYNAMIC_RE.exec(name);

	if (catch_all) {
		return `:${catch_all[1]}(.*)`;
	} else if (dynamic) {
		return `:${dynamic[1]}`;
	}

	return name;
}

function sort_routes (routes: RouteProp[]) {
	let cache: Record<string, number> = {};

	routes.sort(sort);

	for (let child of routes) {
		walk(child);
	}

	function walk (route: RouteProp) {
		route.children.sort(sort);

		for (let child of route.children) {
			walk(child);
		}
	}

	// Crude ranking and sorting method

	function sort (a: RouteProp, b: RouteProp) {
		let a_score = cache[a.path] ??= rank(a.path);
		let b_score = cache[b.path] ??= rank(b.path);

		return a_score - b_score;
	}

	function rank (path: string) {
		let i = 0;
		let final_score = 0;
		let arr = path.split('/');

		for (; i < arr.length; i++) final_score += score(arr[i]);

		return final_score;
	}

	function score (path: string) {
		if (path == '@') return 5; // wild
		if (/^\:(.*)\(/.test(path)) return 4; // param w/ suffix
		if (/^\:(.*)\?/.test(path)) return 3; // param optional
		if (/^\:/.test(path)) return 2; // param
		return 1; // static
	}
}
