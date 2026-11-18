import { expect, test } from "@playwright/test";

const profile = {
	id: "customer-profile",
	role: "CUSTOMER",
	roles: ["CUSTOMER"],
	status: "ACTIVE",
};

test("keeps a non-administrator on sign in and explains the access requirement", async ({
	page,
}) => {
	let signedIn = false;
	await page.route("**/api/auth/**", async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith("/sign-in/email")) {
			signedIn = true;
			return route.fulfill({
				json: {
					token: "session-token",
					user: {
						id: "customer-profile",
						name: "Customer",
						email: "customer@example.test",
						emailVerified: true,
						createdAt: "2026-01-01T00:00:00.000Z",
						updatedAt: "2026-01-01T00:00:00.000Z",
					},
				},
			});
		}
		if (path.endsWith("/get-session"))
			return route.fulfill({
				json: signedIn
					? {
							user: {
								id: "customer-profile",
								name: "Customer",
								email: "customer@example.test",
								emailVerified: true,
								createdAt: "2026-01-01T00:00:00.000Z",
								updatedAt: "2026-01-01T00:00:00.000Z",
							},
							session: {
								id: "session-id",
								userId: "customer-profile",
								token: "session-token",
								expiresAt: "2099-01-01T00:00:00.000Z",
							},
						}
					: null,
			});
		if (path.endsWith("/sign-out")) {
			signedIn = false;
			return route.fulfill({ json: { success: true } });
		}
		return route.fulfill({ status: 404, json: { message: "Not found" } });
	});
	await page.route("**/api/v1/account/me", (route) =>
		route.fulfill({ json: profile }),
	);

	await page.goto("/login");
	await page.getByLabel("Email address").fill("customer@example.test");
	await page.getByLabel("Password").fill("correct-password");
	await page.getByRole("button", { name: "Sign in" }).click();

	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole("alert")).toContainText(
		"does not have administrator permissions",
	);
	await expect(
		page.getByRole("heading", { name: "Administrator access required" }),
	).not.toBeVisible();
});
