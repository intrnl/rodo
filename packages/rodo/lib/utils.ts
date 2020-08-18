export function is_plain_obj (value: any): value is Record<any, any> {
	if (Object.prototype.toString.call(value) !== '[object Object]')
		return false;

	let proto = Object.getPrototypeOf(value);
	return proto === null || proto === Object.prototype;
}

export function escape_re (str: string) {
	return str
		.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
		.replace(/-/g, '\\x2d');
}

export function random (min: number, max: number) {
	return ~~(Math.random() * (max - min + 1) + min);
}

export function random62 (length: number) {
	let set = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let res = ''

	while (length--) res += set[random(0, set.length - 1)];

	return res;
}

export function serialize_raw (value: any, replacer?: (key: string, value: any) => any) {
	let id = random62(6);
	let raw_re = new RegExp(`"__RAW_${id}{{(.*)}}"`, 'g');
	let quote_re = /\\"/g

	return JSON.stringify(value, (k, v) => {
		if (replacer) v = replacer(k, v);

		if (Array.isArray(v) || is_plain_obj(v))
			return v;

		return `__RAW_${id}{{${v}}}`;
	}, 2)
		.replace(raw_re, (match, value) => value.replace(quote_re, '"'));
}
