import { expect, test } from "@playwright/test";

test("keeps a non-administrator on sign in and explains the access requirement", async ({
	page,
}) => {
	await page.route("**/api/auth/**", async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith("/get-session"))
			return route.fulfill({
				json: null,
			});
		return route.fulfill({ status: 404, json: { message: "Not found" } });
	});
	await page.route("**/api/v1/admin/sign-in", (route) =>
		route.fulfill({
			status: 401,
			json: { message: "administrator access is required" },
		}),
	);

	await page.goto("/login");
	await page.getByLabel("Email address").fill("customer@example.test");
	await page.getByLabel("Password").fill("correct-password");
	await page.getByRole("button", { name: "Sign in" }).click();

	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole("alert")).toContainText(
		"administrator access is required",
	);
	await expect(
		page.getByRole("heading", { name: "Administrator access required" }),
	).not.toBeVisible();
});
