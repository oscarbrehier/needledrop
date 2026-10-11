import { getAccessToken } from "./auth.js";
import z from "zod";
import { request } from "./client.js";

const UserResponse = z.object({
	data: z.object({
		id: z.string(),
		attributes: z.object({
			username: z.string(),
			country: z.string(),
		}),
	}),
});

export async function getAuthStatus() {

	const res = await request("/users/me");
	const { data } = UserResponse.parse(res);
	
	return {
		id: data.id,
		username: data.attributes.username,
		country: data.attributes.country
	};

};