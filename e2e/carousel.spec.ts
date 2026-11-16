import { expect, type Page, test } from "@playwright/test";

const png = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
	"base64",
);
const image = {
	id: "image-1",
	publicUrl: "https://media.example.test/carousel/image.png",
	altText: "Concert artwork",
	contentType: "image/png",
	contentLength: png.length,
	createdAt: "2026-11-16T00:00:00Z",
};
async function fixture(
	page: Page,
	failures: {
		upload?: number;
		complete?: number;
		list?: number;
		remove?: number;
	} = {},
) {
	let published = false;
	const requests: string[] = [];
	const credentials: (string | undefined)[] = [];
	await page.route("**/api/auth/**", (route) =>
		route.fulfill({
			json: {
				user: {
					id: "admin",
					name: "Admin",
					email: "admin@example.test",
					emailVerified: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				session: {
					id: "session",
					userId: "admin",
					token: "test",
					expiresAt: "2099-01-01T00:00:00Z",
				},
			},
		}),
	);
	await page.route("**/api/v1/account/me", (route) =>
		route.fulfill({
			json: { id: "admin", role: "ADMIN", roles: ["ADMIN"], status: "ACTIVE" },
		}),
	);
	await page.route("https://media.example.test/**", (route) =>
		route.fulfill({ contentType: "image/png", body: png }),
	);
	await page.route("https://upload.example.test/**", async (route) => {
		if (route.request().method() === "OPTIONS")
			return route.fulfill({
				headers: {
					"access-control-allow-origin": "*",
					"access-control-allow-methods": "PUT",
					"access-control-allow-headers": "*",
				},
				body: "",
			});
		requests.push("PUT");
		credentials.push(
			route.request().headers().authorization,
			route.request().headers().cookie,
		);
		if (failures.upload) {
			failures.upload--;
			return route.fulfill({
				status: 503,
				headers: { "access-control-allow-origin": "*" },
				body: "",
			});
		}
		return route.fulfill({
			headers: { "access-control-allow-origin": "*" },
			body: "",
		});
	});
	await page.route(
		/\/api\/v1\/admin\/carousel\/images(?:\/.*)?$/,
		async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			if (url.pathname.endsWith("/upload-intent")) {
				requests.push("intent");
				expect(request.postDataJSON()).toEqual({
					altText: "Concert artwork",
					contentType: "image/png",
					contentLength: png.length,
				});
				return route.fulfill({
					status: 201,
					json: {
						imageId: "image-1",
						uploadUrl: "https://upload.example.test/carousel/image.png",
						publicUrl: image.publicUrl,
					},
				});
			}
			if (url.pathname.endsWith("/complete")) {
				requests.push("complete");
				if (failures.complete) {
					failures.complete--;
					return route.fulfill({
						status: 409,
						json: { message: "Verification unavailable" },
					});
				}
				published = true;
				return route.fulfill({ status: 201, json: { completed: true } });
			}
			if (request.method() === "DELETE") {
				requests.push("remove");
				published = false;
				if (failures.remove) {
					failures.remove--;
					return route.fulfill({
						status: 503,
						json: { message: "R2 unavailable" },
					});
				}
				return route.fulfill({ json: { removed: true } });
			}
			if (failures.list) {
				failures.list--;
				return route.fulfill({
					status: 503,
					json: { message: "Cannot load images" },
				});
			}
			return route.fulfill({ json: { items: published ? [image] : [] } });
		},
	);
	await page.goto("/jobs");
	await expect(
		page.getByRole("heading", { name: "Landing-page carousel" }),
	).toBeVisible({ timeout: 15000 });
	return { requests, credentials };
}
async function select(page: Page) {
	await page
		.getByLabel("Image", { exact: true })
		.setInputFiles({ name: "image.png", mimeType: "image/png", buffer: png });
	await expect(page.getByAltText("Selected preview")).toBeVisible();
	await page.getByLabel("Alt text", { exact: true }).fill("Concert artwork");
}

test("uploads directly, publishes once, refreshes the ordered library and confirms removal", async ({
	page,
}) => {
	const { requests, credentials } = await fixture(page);
	await select(page);
	await page.getByRole("button", { name: "Upload & publish" }).click();
	await expect(page.locator(".carousel-library-list li")).toHaveCount(1);
	expect(requests).toEqual(["intent", "PUT", "complete"]);
	expect(credentials.every((value) => value === undefined)).toBe(true);
	await expect(page.locator(".carousel-library-list")).toContainText(
		"1. Concert artwork",
	);
	await page.getByRole("button", { name: "Remove", exact: true }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	expect(requests).not.toContain("remove");
	await page.getByRole("button", { name: "Confirm removal" }).click();
	await expect(page.getByText("No carousel images yet.")).toBeVisible();
});

test("rejects invalid files and blank alt text before requesting an upload", async ({
	page,
}) => {
	const { requests } = await fixture(page);
	await page.getByLabel("Image", { exact: true }).setInputFiles({
		name: "bad.svg",
		mimeType: "image/svg+xml",
		buffer: Buffer.from("<svg/>"),
	});
	await expect(page.getByRole("alert")).toContainText("JPEG, PNG or WebP");
	await page.getByLabel("Image", { exact: true }).setInputFiles({
		name: "large.png",
		mimeType: "image/png",
		buffer: Buffer.alloc(5242881),
	});
	await expect(page.getByRole("alert")).toContainText("5 MiB");
	await select(page);
	await page.getByLabel("Alt text", { exact: true }).fill("   ");
	await expect(
		page.getByRole("button", { name: "Upload & publish" }),
	).toBeDisabled();
	expect(requests).toEqual([]);
});

test("retains upload errors and recovers by uploading again", async ({
	page,
}) => {
	const { requests } = await fixture(page, { upload: 1 });
	await select(page);
	await page.getByRole("button", { name: "Upload & publish" }).click();
	await expect(page.getByRole("alert")).toContainText("retry the upload");
	await page.getByRole("button", { name: "Upload & publish" }).click();
	await expect(page.locator(".carousel-library-list li")).toHaveCount(1);
	expect(requests).toEqual(["intent", "PUT", "intent", "PUT", "complete"]);
});

test("retries publication without uploading twice and recovers from removal failure", async ({
	page,
}) => {
	const { requests } = await fixture(page, { complete: 1, remove: 1 });
	await select(page);
	await page.getByRole("button", { name: "Upload & publish" }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Verification unavailable",
	);
	await page.getByRole("button", { name: "Retry publication" }).click();
	await expect(page.locator(".carousel-library-list li")).toHaveCount(1);
	expect(requests).toEqual(["intent", "PUT", "complete", "complete"]);
	await page.getByRole("button", { name: "Remove", exact: true }).click();
	await page.getByRole("button", { name: "Confirm removal" }).click();
	await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
		"R2 unavailable",
	);
	await page.getByRole("button", { name: "Confirm removal" }).click();
	await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("shows a list error and allows retrying", async ({ page }) => {
	await fixture(page, { list: 1 });
	await expect(page.getByRole("alert")).toContainText("Cannot load images");
	await page.getByRole("button", { name: "Retry loading images" }).click();
	await expect(page.getByText("No carousel images yet.")).toBeVisible();
});
