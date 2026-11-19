/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

const records: Record<string, Record<string, unknown>> = {
	events: {
		id: "event_id_exact",
		title: "Lagos live",
		slug: "lagos_live",
		description: "Full event description",
		timeZone: "Africa/Lagos",
		address: "123 Victoria Island, Lagos",
		ticketTypes: [
			{
				id: "vip",
				name: "VIP configuration",
				capacity: 50,
				isActive: false,
				priceKobo: 0,
			},
		],
		media: [
			{
				id: "cover",
				publicUrl: "https://media.example.test/cover.png",
				isCover: true,
			},
		],
		status: "PUBLISHED",
		featured: false,
		startAt: "2026-11-10T10:00:00Z",
		endAt: "2026-11-10T12:00:00Z",
		organizer: {
			id: "org_exact",
			user: { name: "Organizer", email: "org@example.com" },
		},
	},
	users: {
		id: "profile_exact",
		user: { name: "Buyer", email: "buyer@example.com" },
		role: "CUSTOMER",
		roles: ["CUSTOMER", "ORGANIZER"],
		blockedBy: null,
		status: "ACTIVE",
		createdAt: "2026-11-10T10:00:00Z",
		blockedAt: null,
		blockReason: null,
	},
	orders: {
		id: "order_exact",
		reference: "ORDER_ref_exact",
		buyerName: "Buyer",
		buyerEmail: "buyer@example.com",
		status: "PAID",
		totalKobo: 0,
		buyerPhone: "08000000000",
		currency: "NGN",
		ticketSubtotalKobo: 0,
		platformFeeKobo: 0,
		lines: [
			{ id: "line", ticketTypeName: "VIP line", unitPriceKobo: 0, quantity: 1 },
		],
		event: { id: "event_id_exact", title: "Lagos live" },
		paymentAttempts: [
			{
				id: "attempt_exact",
				reference: "PAY_ref_exact",
				status: "VERIFIED_SUCCESS",
				expectedAmountKobo: 12501,
			},
		],
	},
	refunds: {
		id: "refund_exact",
		status: "REQUESTED",
		ticketRefundKobo: 0,
		platformFeeRefundKobo: 0,
		totalRefundKobo: 0,
		order: { id: "order_exact", reference: "ORDER_ref_exact" },
		reason: "Requested refund",
		tickets: [
			{
				ticketId: "ticket_selected",
				ticket: {
					holderName: "Selected holder",
					ticketTypeName: "VIP",
					priceKobo: 0,
					status: "ACTIVE",
				},
			},
		],
	},
	payouts: {
		id: "payout_exact",
		status: "REQUESTED",
		requestedAmountKobo: 0,
		calculatedPayableKobo: 0,
		ticketSubtotalKobo: 10000,
		reservedRefundKobo: 1000,
		priorPaidKobo: 500,
		reviewer: null,
		transferReference: "TRANSFER_ref_exact",
		transferDate: null,
	},
	"fee-rules": {
		id: "rule_exact",
		version: 7,
		mode: "FIXED",
		fixedAmountKobo: 0,
		appliesToFreeOrder: false,
		activeFrom: "2026-11-10T10:00:00Z",
		activeUntil: "2026-11-11T10:00:00Z",
	},
	audit: {
		id: "audit_exact",
		action: "EVENT_SUSPENDED",
		actor: {
			id: "actor",
			role: "ADMIN",
			roles: ["ADMIN"],
			user: { name: "Audit administrator", email: "admin@example.test" },
		},
		targetId: "event_id_exact",
		targetType: "Event",
		createdAt: "2026-11-10T10:00:00Z",
		details: {
			reason: "audit_reason_exact",
			nested: { enabled: false, count: 0 },
			refs: ["ref_one", "ref_two"],
		},
		additionalField: { reference: "extra_ref_exact" },
	},
};
const endpoints: Record<string, string> = {
	refunds: "refund-requests",
	payouts: "payout-requests",
	"fee-rules": "platform-fee-rule",
	audit: "audit-logs",
};
async function mock(page: Page) {
	await page.route("**/api/auth/**", (route) =>
		route.fulfill({
			json: {
				user: {
					id: "admin",
					name: "Administrator",
					email: "admin@example.com",
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
	await page.route("**/api/v1/**", (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith("/account/me"))
			return route.fulfill({
				json: {
					id: "admin",
					role: "ADMIN",
					roles: ["ADMIN"],
					status: "ACTIVE",
				},
			});
		const resource = Object.keys(records).find((name) =>
			url.pathname.includes(`/admin/${endpoints[name] || name}`),
		);
		if (!resource)
			return route.fulfill({
				status: 404,
				json: { message: "Unknown endpoint" },
			});
		return route.fulfill({
			json:
				resource === "fee-rules" ||
				url.pathname.endsWith(`/${records[resource].id}`)
					? records[resource]
					: {
							items: [records[resource]],
							page: Number(url.searchParams.get("page")) || 1,
							pageSize: 20,
							total: 1,
						},
		});
	});
}
for (const resource of Object.keys(records)) {
	test(`${resource}: direct entry, refresh, nested fields and narrow layout`, async ({
		page,
	}) => {
		await mock(page);
		const requests: string[] = [];
		page.on("request", (request) => {
			const path = new URL(request.url()).pathname;
			if (path.startsWith("/api/v1/admin/")) requests.push(path);
		});
		const record = records[resource];
		await page.goto(`/${resource}/${record.id}`);
		await expect(
			page.getByRole("link", {
				name: `Back to ${resource === "audit" ? "Audit log" : resource === "fee-rules" ? "Fee rules" : resource[0].toUpperCase() + resource.slice(1)}`,
			}),
		).toBeVisible();
		await expect(page.getByText("Loading fresh record details…")).toHaveCount(
			0,
		);
		await expect(page.locator(".detail-sections")).toBeVisible();
		if (resource === "orders") {
			await expect(
				page.getByRole("cell", { name: "PAY_ref_exact", exact: true }),
			).toBeVisible();
			await expect(
				page.getByRole("cell", { name: "₦125.01", exact: true }),
			).toBeVisible();
			await expect(
				page.locator("dd").filter({ hasText: /^ORDER_ref_exact$/ }),
			).toBeVisible();
		}
		if (resource === "events" || resource === "fee-rules")
			await expect(
				page.getByText("false", { exact: true }).first(),
			).toBeVisible();
		if (resource === "audit") {
			await expect(
				page.getByText("audit_reason_exact", { exact: true }),
			).toBeVisible();
			await expect(
				page.getByText("extra_ref_exact", { exact: true }),
			).toBeVisible();
			await expect(page.getByText("0", { exact: true })).toBeVisible();
		}
		if (["orders", "refunds", "payouts", "fee-rules"].includes(resource))
			await expect(page.getByText("₦0", { exact: true }).first()).toBeVisible();
		expect(requests).toEqual([
			`/api/v1/admin/${endpoints[resource] || resource}/${record.id}`,
		]);
		if (resource === "events")
			await expect(
				page.getByText("VIP configuration", { exact: true }),
			).toBeVisible();
		if (resource === "orders")
			await expect(page.getByText("VIP line", { exact: true })).toBeVisible();
		if (resource === "refunds")
			await expect(
				page.getByText("Selected holder", { exact: true }),
			).toBeVisible();
		if (resource === "fee-rules") {
			await expect(
				page.getByRole("heading", { name: "Version 7", exact: true }),
			).toBeVisible();
			await expect(
				page.getByRole("button", { name: "Replace active fee rule" }),
			).toBeVisible();
		}
		await page.reload();
		await expect(page.locator(".detail-sections")).toBeVisible();
		expect(requests).toHaveLength(2);
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.locator(".detail-sections")).toBeVisible();
		expect(
			await page.evaluate(
				"document.documentElement.scrollWidth <= window.innerWidth",
			),
		).toBe(true);
	});
}
test("list and legacy links preserve search, filters and page across refresh", async ({
	page,
}) => {
	await mock(page);
	await page.goto("/orders?q=buyer&status=PAID&page=3");
	await page.getByRole("link", { name: "View details" }).click();
	await expect(page).toHaveURL(/\/orders\/order_exact\?from=/);
	await page.reload();
	await page.getByRole("link", { name: "Back to Orders" }).click();
	await expect(page).toHaveURL("/orders?q=buyer&status=PAID&page=3");
	await page.goto("/orders?q=buyer&status=PAID&page=3&record=order_exact");
	await expect(page).toHaveURL(/\/orders\/order_exact\?from=/);
	await page.getByRole("link", { name: "Back to Orders" }).click();
	await expect(page).toHaveURL("/orders?q=buyer&status=PAID&page=3");
});
test("confirmation cancellation, failure and refreshed action availability", async ({
	page,
}) => {
	await mock(page);
	let status = "REQUESTED";
	let fail = true;
	let submissions = 0;
	await page.route(/\/api\/v1\/admin\/refund-requests(?:[/?]|$)/, (route) => {
		if (route.request().method() === "POST") {
			submissions++;
			if (fail)
				return route.fulfill({
					status: 500,
					json: { message: "Review failed" },
				});
			status = "REJECTED";
			return route.fulfill({ json: { success: true } });
		}
		return route.fulfill({
			json: { ...records.refunds, status },
		});
	});
	await page.goto("/refunds/refund_exact");
	await page
		.getByRole("button", { name: "Reject refund", exact: true })
		.click();
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	expect(submissions).toBe(0);
	await page
		.getByRole("button", { name: "Reject refund", exact: true })
		.click();
	await page.getByRole("textbox").fill("Duplicate request");
	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Reject refund", exact: true })
		.click();
	await expect(page.getByRole("alert")).toHaveText("Review failed");
	fail = false;
	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Reject refund", exact: true })
		.click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Reject refund", exact: true }),
	).toHaveCount(0);
	await expect(page.getByText("REJECTED", { exact: true })).toBeVisible();
	expect(submissions).toBe(2);
});
test("detail errors retry and missing records show unavailable", async ({
	page,
}) => {
	await mock(page);
	let fail = true;
	await page.route(/\/api\/v1\/admin\/platform-fee-rule(?:[/?]|$)/, (route) =>
		fail
			? route.fulfill({ status: 500, json: { message: "Lookup failed" } })
			: route.fulfill({ status: 404, json: { message: "record not found" } }),
	);
	await page.goto("/fee-rules/old_rule");
	await expect(page.getByRole("alert")).toContainText("Lookup failed");
	fail = false;
	await page.getByRole("button", { name: "Try again" }).click();
	await expect(page.getByText(/This record is unavailable/)).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Replace active fee rule" }),
	).toHaveCount(0);
});

test("cached preview disables actions until fresh lookup, and navigation cancels lookup", async ({
	page,
}) => {
	await mock(page);
	await page.goto("/events");
	await expect(page.getByRole("link", { name: "View details" })).toBeVisible();
	let release: () => void = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let requested = false;
	await page.route(/\/api\/v1\/admin\/events(?:[/?]|$)/, async (route) => {
		requested = true;
		await gate;
		await route
			.fulfill({
				json: records.events,
			})
			.catch(() => {});
	});
	await page.getByRole("link", { name: "View details" }).click();
	await expect(
		page.getByRole("button", { name: "Suspend event" }),
	).toBeDisabled();
	await expect(page.getByText("false", { exact: true }).first()).toBeVisible();
	await expect.poll(() => requested).toBe(true);
	const cancelled = page.waitForEvent("requestfailed", (request) =>
		request.url().includes("/admin/events"),
	);
	await page.getByRole("link", { name: "Users", exact: true }).click();
	await cancelled;
	release();
	await expect(
		page.getByRole("heading", { name: "Users", exact: true }),
	).toBeVisible();
});

test("direct entry requests only the detail endpoint without collection scans", async ({
	page,
}) => {
	await mock(page);
	const paths: string[] = [];
	await page.route(/\/api\/v1\/admin\/orders(?:[/?]|$)/, (route) => {
		paths.push(new URL(route.request().url()).pathname);
		return route.fulfill({ json: records.orders });
	});
	await page.goto("/orders/order_exact?from=q%3Dbuyer%26page%3D9");
	await expect(
		page.getByRole("heading", { name: "ORDER_ref_exact", exact: true }),
	).toBeVisible();
	expect(paths).toEqual(["/api/v1/admin/orders/order_exact"]);
});

for (const mode of ["FIXED", "PERCENTAGE"]) {
	test(`fee rules: add ${mode} from ${mode === "FIXED" ? "empty" : "populated"} page`, async ({
		page,
	}) => {
		await mock(page);
		let reads = 0;
		const submissions: unknown[] = [];
		await page.route(
			/\/api\/v1\/admin\/platform-fee-rule(?:\?|$)/,
			async (route) => {
				if (route.request().method() === "POST") {
					submissions.push(route.request().postDataJSON());
					await new Promise((resolve) => setTimeout(resolve, 300));
					return route.fulfill({
						status: 201,
						json: { id: "new_rule", version: 8, mode },
					});
				}
				reads += 1;
				return route.fulfill({
					body: JSON.stringify(mode === "FIXED" ? null : records["fee-rules"]),
					contentType: "application/json",
				});
			},
		);
		await page.goto("/fee-rules");
		if (mode === "FIXED")
			await expect(page.getByText("No records found.")).toBeVisible();
		await page
			.getByRole("button", { name: "Add fee rule", exact: true })
			.click();
		const dialog = page.getByRole("dialog");
		await dialog.getByRole("combobox").selectOption(mode);
		await dialog
			.getByLabel(
				mode === "PERCENTAGE"
					? "Percentage (basis points)"
					: "Fixed amount (kobo)",
			)
			.fill("250");
		await dialog
			.getByLabel("Effective at (Africa/Lagos)")
			.fill("2099-11-11T10:30");
		await dialog.getByLabel("Reason", { exact: true }).fill("New fee schedule");
		await dialog.locator('button[type="submit"]').click();
		await expect(
			dialog.getByRole("button", { name: "Saving…" }),
		).toBeDisabled();
		await expect(dialog).not.toBeVisible();
		await expect(
			page.locator('[data-sonner-toast][data-type="success"]'),
		).toHaveCount(1);
		await expect(
			page.locator('[data-sonner-toast][data-type="success"]'),
		).toContainText("Fee rule added");
		await expect(
			page.getByRole("link", { name: "View added fee rule" }),
		).toHaveAttribute("href", /\/fee-rules\/new_rule/);
		expect(submissions).toEqual([
			{
				mode,
				[mode === "FIXED" ? "fixedAmountKobo" : "percentageBasisPoints"]: 250,
				effectiveAt: "2099-11-11T09:30:00.000Z",
				reason: "New fee schedule",
			},
		]);
		expect(reads).toBeGreaterThan(1);
		await page.getByRole("link", { name: "View added fee rule" }).click();
		await expect(page.locator(".detail-sections")).toBeVisible();
	});
}

test("fee rules: failed add preserves values and permits retry", async ({
	page,
}) => {
	await mock(page);
	let attempts = 0;
	await page.route(/\/api\/v1\/admin\/platform-fee-rule(?:\?|$)/, (route) => {
		if (route.request().method() !== "POST")
			return route.fulfill({ json: records["fee-rules"] });
		attempts += 1;
		return attempts === 1
			? route.fulfill({
					status: 409,
					json: { message: "A rule already starts at this time." },
				})
			: route.fulfill({
					status: 201,
					json: { id: "new_rule", version: 8, mode: "FIXED" },
				});
	});
	await page.goto("/fee-rules");
	await page.getByRole("button", { name: "Add fee rule", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Fixed amount (kobo)").fill("500");
	await dialog
		.getByLabel("Effective at (Africa/Lagos)")
		.fill("2099-11-11T10:30");
	await dialog.getByLabel("Reason", { exact: true }).fill("New fee schedule");
	await dialog.locator('button[type="submit"]').click();
	await expect(dialog.getByRole("alert")).toHaveText(
		"A rule already starts at this time.",
	);
	await expect(
		page.locator('[data-sonner-toast][data-type="error"]'),
	).toHaveCount(1);
	await expect(
		page.locator('[data-sonner-toast][data-type="error"]'),
	).toContainText("A rule already starts at this time.");
	await expect(
		page.locator('[data-sonner-toast][data-type="success"]'),
	).toHaveCount(0);
	await expect(dialog.getByLabel("Reason", { exact: true })).toHaveValue(
		"New fee schedule",
	);
	await dialog
		.getByLabel("Effective at (Africa/Lagos)")
		.fill("2099-11-12T10:30");
	await dialog.locator('button[type="submit"]').click();
	await expect(dialog).not.toBeVisible();
	await expect(
		page.locator('[data-sonner-toast][data-type="success"]'),
	).toHaveCount(1);
	expect(attempts).toBe(2);
});

const actionScenarios = [
	["users", "ACTIVE", "Block profile", "User blocked"],
	["events", "PUBLISHED", "Feature event", "Event featured"],
	["refunds", "REQUESTED", "Approve refund", "Refund approved"],
	["refunds", "APPROVED", "Execute refund", "Refund processing started"],
	["payouts", "APPROVED", "Record transfer", "Payout transfer recorded"],
	["fee-rules", "ACTIVE", "Replace active fee rule", "Fee rule replaced"],
];
for (const [resource, status, label, message] of actionScenarios) {
	test(`action feedback: ${label}`, async ({ page }) => {
		await mock(page);
		const record = {
			...records[resource],
			status,
			featured: label === "Remove feature",
			gatewayRefundReference: "gateway_ref",
		};
		let submissions = 0;
		await page.route(
			`**/api/v1/admin/${endpoints[resource] || resource}/**`,
			async (route) => {
				if (route.request().method() !== "GET") {
					submissions++;
					await new Promise((resolve) => setTimeout(resolve, 200));
				}
				return route.fulfill({ json: record });
			},
		);
		// Fee replacement targets the collection endpoint.
		if (resource === "fee-rules")
			await page.route("**/api/v1/admin/platform-fee-rule", (route) => {
				if (route.request().method() !== "GET") submissions++;
				return route.fulfill({ json: record });
			});
		await page.goto(`/${resource}/${records[resource].id}`);
		await page.getByRole("button", { name: label, exact: true }).click();
		const dialog = page.getByRole("dialog");
		for (const input of await dialog.locator("input").all()) {
			const type = await input.getAttribute("type");
			await input.fill(
				type === "datetime-local"
					? "2099-11-11T10:30"
					: type === "number"
						? "100"
						: "Reviewed reference",
			);
		}
		await dialog.locator('button[type="submit"]').click();
		await expect(dialog).not.toBeVisible();
		const toasts = page.locator('[data-sonner-toast][data-type="success"]');
		await expect(toasts).toHaveCount(1);
		await expect(toasts).toContainText(message);
		expect(submissions).toBe(1);
	});
}

test("cancel and invalid action submissions produce no toasts or requests", async ({
	page,
}) => {
	await mock(page);
	let submissions = 0;
	page.on("request", (request) => {
		if (request.method() === "POST") submissions++;
	});
	await page.goto("/users/profile_exact");
	await page.getByRole("button", { name: "Block profile" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.locator('button[type="submit"]').click();
	await expect(dialog.getByRole("alert")).toHaveText("Enter reason.");
	await dialog.getByRole("button", { name: "Cancel" }).click();
	await expect(dialog).not.toBeVisible();
	await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
	expect(submissions).toBe(0);
});

for (const width of [1440, 390]) {
	test(`brand surfaces and form states at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/login");
		await expect(page.getByPlaceholder("you@everyticket.ng")).toBeVisible();
		const primary = page.getByRole("button", { name: "Sign in" });
		await expect(primary).toHaveCSS("background-color", "rgb(86, 0, 120)");
		await primary.hover();
		await expect(primary).toHaveCSS("background-color", "rgb(54, 0, 79)");
		await page.getByLabel("Password", { exact: true }).focus();
		await expect(page.getByLabel("Password", { exact: true })).toHaveCSS(
			"outline-color",
			"rgb(143, 34, 242)",
		);
		await page.screenshot({
			path: `.scratch/ui-polish/evidence/login-${width}.png`,
			fullPage: true,
		});
		await mock(page);
		await page.route("**/api/v1/admin/summary", (route) =>
			route.fulfill({
				json: {
					paidOrderCount: 12,
					totalPaidKobo: 100000,
					platformFeeRevenueKobo: 2500,
					refundLiabilityKobo: 1000,
					payoutLiabilityKobo: 5000,
				},
			}),
		);
		await page.goto("/overview");
		await expect(page.locator(".overview-metric")).toHaveCount(5);
		await page.goto("/fee-rules");
		await expect(page.locator(".nav-item.active")).toContainText("Fee rules");
		await page
			.getByRole("button", { name: "Add fee rule", exact: true })
			.click();
		await expect(page.getByLabel("Mode", { exact: true })).toBeVisible();
		await expect(page.getByLabel("Effective at (Africa/Lagos)")).toBeVisible();
	});
}

test("list filters reset the page and pagination preserves filters", async ({
	page,
}) => {
	await mock(page);
	await page.route(/\/api\/v1\/admin\/orders(?:\?|$)/, (route) => {
		const url = new URL(route.request().url());
		return route.fulfill({
			json: {
				items: [records.orders],
				page: Number(url.searchParams.get("page")) || 1,
				pageSize: 20,
				total: 40,
			},
		});
	});
	await page.goto("/orders?q=buyer&status=PAID&page=2");
	await expect(
		page.getByRole("button", { name: "Next", exact: true }),
	).toBeDisabled();
	await page.getByLabel("Status", { exact: true }).selectOption("FAILED");
	await expect(page).toHaveURL("/orders?q=buyer&status=FAILED");
	await expect(
		page.getByRole("button", { name: "Previous", exact: true }),
	).toBeDisabled();
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(page).toHaveURL("/orders?q=buyer&status=FAILED&page=2");
	await page.getByLabel("Search records", { exact: true }).fill("new");
	await expect(page).toHaveURL("/orders?q=new&status=FAILED");
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await page.getByRole("button", { name: "Previous", exact: true }).click();
	await expect(page).toHaveURL("/orders?q=new&status=FAILED&page=1");
});

test("list loading, error retry and empty state disable export", async ({
	page,
}) => {
	await mock(page);
	let release = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let recover = false;
	await page.route(/\/api\/v1\/admin\/orders(?:\?|$)/, async (route) => {
		await gate;
		if (!recover) {
			return route.fulfill({ status: 403, json: { message: "Forbidden" } });
		}
		return route.fulfill({
			json: { items: [], page: 1, pageSize: 20, total: 0 },
		});
	});
	await page.goto("/orders");
	try {
		await expect(
			page.getByText("Loading records…", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Export current page" }),
		).toBeDisabled();
	} finally {
		release();
	}
	await expect(page.getByRole("alert")).toContainText(
		"You do not have permission",
	);
	await expect(
		page.getByRole("button", { name: "Export current page" }),
	).toBeDisabled();
	recover = true;
	await page.getByRole("button", { name: "Try again" }).click();
	await expect(page.getByText("No records found.")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Export current page" }),
	).toBeDisabled();
	await expect(
		page.getByRole("button", { name: "Next", exact: true }),
	).toBeDisabled();
	await expect(
		page.getByRole("button", { name: "Previous", exact: true }),
	).toBeDisabled();
});

test("CSV exports only the current page with raw kobo and escaped cells", async ({
	page,
}) => {
	await mock(page);
	await page.route(/\/api\/v1\/admin\/orders(?:\?|$)/, (route) =>
		route.fulfill({
			json: {
				items: [
					{
						id: "page-two",
						reference: '=SUM("x")',
						status: "PAID",
						totalKobo: 0,
					},
				],
				page: 2,
				pageSize: 20,
				total: 40,
			},
		}),
	);
	await page.goto("/orders?page=2");
	const pending = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export current page" }).click();
	const download = await pending;
	expect(download.suggestedFilename()).toBe("orders-current-page.csv");
	const stream = await download.createReadStream();
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	expect(Buffer.concat(chunks).toString("utf8")).toBe(
		'\uFEFF"ID","Record","Status","Amount (kobo)"\r\n"page-two","\'=SUM(""x"")","PAID","0"',
	);
});

test("polish: pending dialog survives dismissal and repeat submission", async ({
	page,
}) => {
	await mock(page);
	let release = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let submissions = 0;
	await page.route("**/admin/events/*/featured", async (route) => {
		submissions++;
		expect(route.request().postDataJSON()).toEqual({ featured: true });
		await gate;
		await route.fulfill({ json: { success: true } });
	});
	await page.goto("/events/event_id_exact");
	const opener = page.getByRole("button", {
		name: "Feature event",
		exact: true,
	});
	await opener.click();
	const dialog = page.getByRole("dialog");
	await dialog
		.getByRole("button", { name: /Confirm$|^Feature event$/ })
		.click();
	try {
		await expect.poll(() => submissions).toBe(1);
		await dialog
			.getByRole("button", { name: "Close dialog" })
			.dispatchEvent("click");
		await expect(dialog).toBeVisible();
		await dialog.getByRole("button", { name: "Cancel" }).dispatchEvent("click");
		await page.keyboard.press("Escape");
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByRole("button", { name: "Close dialog" }),
		).toBeDisabled();
		await dialog.locator("form").dispatchEvent("submit");
		expect(submissions).toBe(1);
	} finally {
		release();
	}
	await expect(dialog).not.toBeVisible();
	await expect(opener).toBeFocused();
	expect(await page.evaluate("document.body.style.overflow")).toBe("");
});

test("polish: reduced motion uses opacity only", async ({ page }) => {
	await mock(page);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/events/event_id_exact");
	await page.addStyleTag({
		content: ".modal[open] { animation-play-state: paused; }",
	});
	await page
		.getByRole("button", { name: "Feature event", exact: true })
		.click();
	const frames: Record<string, unknown>[] = await page
		.getByRole("dialog")
		.evaluate((element) =>
			element.getAnimations().flatMap((animation) => {
				animation.pause();
				animation.playbackRate = 0.1;
				return (animation.effect as KeyframeEffect).getKeyframes();
			}),
		);
	expect(frames.length).toBeGreaterThan(0);
	for (const frame of frames) {
		expect(frame.translate).toBeUndefined();
		expect(frame.transform).toBeUndefined();
		expect(frame.filter).toBeUndefined();
		expect(frame.scale).toBeUndefined();
	}
});

for (const width of [320, 390, 768, 1440]) {
	test(`polish: collections and navigation at ${width}px`, async ({ page }) => {
		await mock(page);
		await page.setViewportSize({ width, height: 900 });
		for (const resource of Object.keys(records)) {
			await page.goto(`/${resource}`);
			const link = page.getByRole("link", { name: "View details" });
			await expect(link).toBeVisible();
			const box = await link.boundingBox();
			expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
			expect(
				await page.evaluate(
					"document.documentElement.scrollWidth <= innerWidth",
				),
			).toBe(true);
			if (width < 650) expect(box?.height).toBeGreaterThanOrEqual(44);
		}
		if (width < 1100) {
			const opener = page.getByRole("button", { name: "Menu", exact: true });
			await opener.focus();
			await page.keyboard.press("Enter");
			const menu = page.getByRole("dialog", { name: "Navigation" });
			await expect(menu).toBeVisible();
			await expect(menu.getByRole("link")).toHaveCount(10);
			for (let tab = 0; tab < 15; tab++) {
				await page.keyboard.press("Tab");
				expect(
					await menu.evaluate(
						(element) =>
							element.contains(document.activeElement) ||
							document.activeElement === document.body,
					),
				).toBe(true);
			}
			if (width === 320)
				await page.screenshot({
					path: ".scratch/ui-polish/evidence/mobile-menu.png",
				});

			for (const link of await menu.getByRole("link").all()) {
				await link.scrollIntoViewIfNeeded();
				await expect(link).toBeInViewport();
			}
			await page.keyboard.press("Escape");
			await expect(opener).toBeFocused();
			await opener.click();
			await menu.getByRole("link", { name: "Orders", exact: true }).click();
			await expect(menu).not.toBeVisible();
			await expect(page).toHaveURL("/orders");
		}
		console.log(`Polish ${width}px targets`, {
			signOut: await page
				.getByRole("button", { name: "Sign out", exact: true })
				.boundingBox(),
			action: await page
				.getByRole("link", { name: "View details" })
				.boundingBox(),
		});
		await page.screenshot({
			path: `.scratch/ui-polish/evidence/collection-${width}.png`,
			fullPage: true,
		});
	});
}

test("polish: field errors, fee interpretation and contextual media", async ({
	page,
}) => {
	await mock(page);
	await page.goto("/fee-rules");
	await page.getByRole("button", { name: "Add fee rule" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.locator('button[type="submit"]').click();
	const amount = dialog.getByLabel("Fixed amount (kobo)");
	await expect(amount).toHaveAttribute("aria-invalid", "true");
	const errorId = (await amount.getAttribute("aria-describedby"))
		?.split(" ")
		.pop();
	await expect(page.locator(`[id="${errorId}"]`)).toHaveText(
		"Enter fixed amount (kobo).",
	);
	await amount.fill("250");
	await expect(dialog.getByText(/Preview: ₦2.50/)).toBeVisible();
	await dialog.getByLabel("Mode", { exact: true }).selectOption("PERCENTAGE");
	await expect(dialog.getByLabel("Percentage (basis points)")).toHaveValue(
		"250",
	);
	await expect(dialog.getByText(/Preview: 2.5%/)).toBeVisible();
	await dialog.getByLabel("Percentage (basis points)").fill("-1");
	await dialog.locator('button[type="submit"]').click();
	await expect(
		dialog
			.getByRole("alert")
			.filter({ hasText: "whole non-negative basis point" }),
	).toBeVisible();
	await expect(dialog.getByLabel("Percentage (basis points)")).toBeFocused();
	await page.screenshot({
		path: ".scratch/ui-polish/evidence/fee-validation.png",
		fullPage: true,
	});
	await page.keyboard.press("Escape");
	await page.goto("/events/event_id_exact");
	await expect(
		page.getByRole("link", { name: "Open public Url media" }),
	).toHaveAttribute("href", "https://media.example.test/cover.png");
	await page
		.getByRole("button", { name: "Feature event", exact: true })
		.click();
	await expect(dialog).toContainText("Lagos live");
	await expect(dialog).toContainText("event_id_exact");
	await expect(
		dialog.getByRole("heading", { name: "Feature event" }),
	).toHaveCount(1);
	await page.screenshot({
		path: ".scratch/ui-polish/evidence/context-dialog.png",
		fullPage: true,
	});
});

test("polish: rendered contrast, targets, forced colors and slow motion evidence", async ({
	page,
}) => {
	await mock(page);
	await page.goto("/orders");
	console.log(
		"Polish rendered pairs",
		await page
			.locator(".records-panel th")
			.first()
			.evaluate((element) => ({
				foreground: getComputedStyle(element).color,
				background: getComputedStyle(element).backgroundColor,
			})),
	);
	console.log(
		"Polish boundary",
		await page.getByLabel("Search records").evaluate((element) => ({
			border: getComputedStyle(element).borderColor,
			background: getComputedStyle(element).backgroundColor,
		})),
	);
	await page.emulateMedia({ forcedColors: "active" });
	await page.getByLabel("Search records").focus();
	await expect(page.getByLabel("Search records")).toHaveCSS(
		"border-style",
		"solid",
	);
	await page.screenshot({
		path: ".scratch/ui-polish/evidence/forced-colors.png",
		fullPage: true,
	});
	await page.emulateMedia({
		forcedColors: "none",
		reducedMotion: "no-preference",
	});
	await page.goto("/events/event_id_exact");
	await page.addStyleTag({
		content: ".modal[open] { animation-play-state: paused; }",
	});
	await page
		.getByRole("button", { name: "Feature event", exact: true })
		.click();
	const animationNames = await page.getByRole("dialog").evaluate((element) =>
		element.getAnimations().map((animation) => {
			animation.pause();
			animation.playbackRate = 0.1;
			animation.currentTime = 90;
			return (animation as CSSAnimation).animationName;
		}),
	);
	expect(animationNames).toContain("modal-enter");
	await page.screenshot({
		path: ".scratch/ui-polish/evidence/motion-midpoint.png",
		fullPage: true,
	});
	await page.getByRole("dialog").evaluate(async (element) => {
		const animations = element.getAnimations();
		for (const animation of animations) {
			animation.currentTime = 0;
			animation.playbackRate = 0.1;
			animation.play();
		}
		await Promise.all(animations.map((animation) => animation.finished));
	});
	await expect(page.getByRole("dialog")).toHaveCSS("translate", "none");
});

test("polish: delayed failure retains values, allows dismissal and retries once", async ({
	page,
}) => {
	await mock(page);
	let release = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let submissions = 0;
	await page.route("**/admin/users/profile_exact/block", async (route) => {
		submissions++;
		expect(route.request().postDataJSON()).toEqual({
			reason: "Review preserved",
		});
		if (submissions === 1) {
			await gate;
			return route.fulfill({
				status: 500,
				json: { message: "Try this review again" },
			});
		}
		return route.fulfill({ json: { success: true } });
	});
	await page.goto("/users/profile_exact");
	await page
		.getByRole("button", { name: "Block profile", exact: true })
		.click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Reason", { exact: true }).fill("Review preserved");
	await dialog.locator('button[type="submit"]').click();
	try {
		await expect.poll(() => submissions).toBe(1);
		await page.keyboard.press("Escape");
		await expect(dialog).toBeVisible();
	} finally {
		release();
	}
	await expect(dialog.getByRole("alert")).toHaveText("Try this review again");
	await expect(dialog.getByLabel("Reason", { exact: true })).toHaveValue(
		"Review preserved",
	);
	await expect(
		dialog.getByRole("button", { name: "Close dialog" }),
	).toBeEnabled();
	await dialog.locator('button[type="submit"]').click();
	await expect(dialog).not.toBeVisible();
	expect(submissions).toBe(2);
});

test("polish: long records, wide table keyboard scrolling and zoomed desktop", async ({
	page,
}) => {
	await mock(page);
	const long = {
		...records.orders,
		reference: "LONG_REFERENCE_".repeat(12),
		buyerName: "An organizer with a very long name ".repeat(6),
		buyerEmail: `${"address".repeat(20)}@example.test`,
		totalKobo: 98765432101,
	};
	await page.route("**/api/v1/admin/orders**", (route) =>
		route.fulfill({ json: { items: [long], total: 1, page: 1, pageSize: 20 } }),
	);
	await page.setViewportSize({ width: 320, height: 900 });
	await page.goto("/orders");
	await page
		.getByRole("link", { name: "View details" })
		.scrollIntoViewIfNeeded();
	await expect(
		page.getByRole("link", { name: "View details" }),
	).toBeInViewport();
	expect(
		await page.evaluate("document.documentElement.scrollWidth <= innerWidth"),
	).toBe(true);
	await page.screenshot({
		path: ".scratch/ui-polish/evidence/long-mobile.png",
		fullPage: true,
	});
	await page.unroute("**/api/v1/admin/orders**");
	await page.goto("/orders/order_exact");
	const scroll = page.getByRole("region", { name: "Payment attempts" });
	await expect(page.getByText(/More columns/)).toBeVisible();
	await scroll.focus();
	await page.keyboard.press("ArrowRight");
	await expect
		.poll(() => scroll.evaluate((element) => element.scrollLeft))
		.toBeGreaterThan(0);
	await page.screenshot({
		path: ".scratch/ui-polish/evidence/detail-mobile.png",
		fullPage: true,
	});
	await page.setViewportSize({ width: 720, height: 450 });
	const cdp = await page.context().newCDPSession(page);
	// Equivalent layout viewport and pixel density to a 1440px desktop at 200% zoom.
	await cdp.send("Emulation.setDeviceMetricsOverride", {
		width: 720,
		height: 450,
		deviceScaleFactor: 2,
		mobile: false,
	});
	await page.goto("/orders");
	await expect(page.getByRole("link", { name: "View details" })).toBeVisible();
	expect(
		await page.evaluate("document.documentElement.scrollWidth <= innerWidth"),
	).toBe(true);
	await page.screenshot({
		path: ".scratch/ui-polish/evidence/zoom-desktop.png",
		fullPage: true,
	});
});

test("polish: media allows HTTP links, rejects unsafe URLs and uses known image types", async ({
	page,
}) => {
	await mock(page);
	await page.route("**/api/v1/admin/events/event_id_exact", (route) =>
		route.fulfill({
			json: {
				...records.events,
				media: [
					{ publicUrl: "javascript:alert(1)", altText: "Unsafe source" },
					{
						publicUrl: "http://media.example.test/video",
						contentType: "video/mp4",
						altText: "Event video",
					},
					{
						publicUrl: "https://media.example.test/photo",
						contentType: "image/jpeg",
						altText: "Stage photo",
					},
				],
			},
		}),
	);
	await page.route("https://media.example.test/photo", (route) =>
		route.fulfill({ status: 404, body: "" }),
	);
	await page.goto("/events/event_id_exact");
	await expect(
		page.getByText("javascript:alert(1)", { exact: true }),
	).toBeVisible();
	await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Open Event video" }),
	).toHaveAttribute("href", "http://media.example.test/video");
	await expect(
		page.getByRole("link", { name: "Open Stage photo" }),
	).toHaveAttribute("rel", "noopener noreferrer");
	await expect(page.getByRole("img", { name: "Stage photo" })).toHaveCount(0);
});
