import { type Context } from "hono";
import { type ContentfulStatusCode } from "hono/utils/http-status";
import z from "zod";

export class HttpError extends Error {

	constructor(public status: ContentfulStatusCode, message: string) {
		super(message);
		this.name = "HttpError";
	};

};

export async function readBody<T>(c: Context, schema: z.ZodType<T>): Promise<T> {

	let body: unknown;

	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, "Body must be JSON");
	};

	return schema.parse(body);

};