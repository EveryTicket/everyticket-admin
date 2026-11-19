import { type ReactNode, useEffect, useRef, useState } from "react";
import { date, money } from "@/features/admin/format";
import type { RecordItem, Resource } from "./contracts";

const sections: Record<Resource, Record<string, string[]>> = {
	events: {
		Identity: ["id", "title", "slug", "description", "category"],
		Location: ["city", "state", "venue", "address"],
		Publication: [
			"status",
			"featured",
			"publishedAt",
			"suspendedAt",
			"suspendedReason",
			"cancelledAt",
			"cancelledReason",
		],
		Schedule: ["startAt", "endAt", "timeZone"],
		Configuration: ["ticketTypes", "media"],
		Timestamps: ["createdAt", "updatedAt"],
		Organizer: ["organizer"],
	},
	users: {
		Identity: ["id", "user"],
		Profile: ["role", "roles", "status", "createdAt", "updatedAt"],
		Blocking: ["blockedAt", "blockedByProfileId", "blockedBy", "blockReason"],
	},
	orders: {
		Booking: ["id", "reference", "status", "createdAt"],
		Buyer: ["buyerName", "buyerEmail", "buyerPhone", "customerProfile"],
		Event: ["event"],
		Amounts: [
			"currency",
			"ticketSubtotalKobo",
			"platformFeeKobo",
			"paystackFeeKobo",
			"paystackChargeKobo",
			"totalKobo",
		],
		"Fee snapshot": [
			"platformFeeRuleId",
			"platformFeeRuleVersion",
			"platformFeeMode",
			"platformFeePercentageBasisPoints",
			"platformFeeFixedAmountKobo",
		],
		"Order lines": ["lines"],
		"Payment timing": ["holdExpiresAt", "paidAt"],
		"Payment attempts": ["paymentAttempts"],
	},
	refunds: {
		Request: ["id", "status", "reason", "requestedAt"],
		Amounts: ["ticketRefundKobo", "platformFeeRefundKobo", "totalRefundKobo"],
		Review: ["reviewReason", "reviewedAt", "reviewedByProfileId", "reviewer"],
		Timestamps: ["createdAt", "updatedAt"],
		"Gateway processing": [
			"gatewayRefundReference",
			"gatewayStatus",
			"processedAt",
		],
		"Selected tickets": ["tickets"],
		"Related identities": ["organizer", "event", "order"],
	},
	payouts: {
		Request: ["id", "status", "requestedAt"],
		"Organizer and event": ["organizer", "event"],
		"Payable amounts": [
			"ticketSubtotalKobo",
			"reservedRefundKobo",
			"priorPaidKobo",
			"requestedAmountKobo",
			"calculatedPayableKobo",
		],
		Review: ["reviewReason", "reviewedAt", "reviewedByProfileId", "reviewer"],
		Timestamps: ["createdAt", "updatedAt"],
		Transfer: ["transferReference", "transferDate", "paidAt"],
	},
	"fee-rules": {
		Version: ["id", "version"],
		Calculation: ["mode", "percentageBasisPoints", "fixedAmountKobo"],
		Applicability: ["appliesToFreeOrder"],
		"Effective dates": ["activeFrom", "activeUntil"],
		Administration: ["createdAt", "changedByProfileId", "changedBy"],
	},
	audit: {
		Action: ["id", "action"],
		Target: ["targetType", "targetId"],
		Timestamp: ["createdAt"],
		Actor: ["actorProfileId", "actor"],
		"Structured details": ["details"],
	},
};
const label = (key: string) =>
	key.replace(/Kobo$/, " (NGN)").replace(/([a-z])([A-Z])/g, "$1 $2");
function MediaLink({
	url,
	title,
	image,
}: {
	url: string;
	title: string;
	image: boolean;
}) {
	const [failed, setFailed] = useState(false);
	return (
		<div>
			{image && !failed && (
				<img
					className="event-media-preview"
					src={url}
					alt={title}
					onError={() => setFailed(true)}
				/>
			)}
			<a
				className="text-link"
				href={url}
				target="_blank"
				rel="noopener noreferrer"
			>
				Open {title}
			</a>
		</div>
	);
}
function DetailScroll({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLElement>(null);
	const [overflow, setOverflow] = useState(false);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(() =>
			setOverflow(element.scrollWidth > element.clientWidth),
		);
		observer.observe(element);
		if (element.firstElementChild) observer.observe(element.firstElementChild);
		return () => observer.disconnect();
	}, []);
	return (
		<div>
			{overflow && (
				<p className="detail-scroll-hint">
					More columns → Scroll horizontally; keyboard users can focus the table
					and use arrow keys.
				</p>
			)}
			<section
				ref={ref}
				className="detail-table"
				aria-label="Payment attempts"
				tabIndex={overflow ? 0 : undefined}
			>
				{children}
			</section>
		</div>
	);
}
function Value({
	field,
	value,
	media = false,
}: {
	field: string;
	value: unknown;
	media?: boolean;
}) {
	if (value == null) return <span>—</span>;
	if (Array.isArray(value)) {
		if (!value.length) return <span>None</span>;
		if (field === "paymentAttempts") {
			const columns = [...new Set(value.flatMap((item) => Object.keys(item)))];
			return (
				<DetailScroll>
					<table>
						<thead>
							<tr>
								{columns.map((key) => (
									<th key={key}>{label(key)}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{value.map((item, index) => (
								<tr key={item.id ?? index}>
									{columns.map((key) => (
										<td key={key}>
											<Value field={key} value={item[key]} />
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</DetailScroll>
			);
		}
		return (
			<ol>
				{value.map((item, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: Read-only API arrays may contain duplicate primitives without IDs.
					<li key={index}>
						<Value
							field={field}
							value={item}
							media={media || field === "media"}
						/>
					</li>
				))}
			</ol>
		);
	}
	if (typeof value === "object")
		return (
			<Fields
				values={value as Record<string, unknown>}
				media={media || field === "media"}
			/>
		);
	if (typeof value === "number" && field.endsWith("Kobo"))
		return <>{money(value)}</>;
	if (typeof value === "number" && field.endsWith("BasisPoints"))
		return (
			<>
				{value} ({value / 100}%)
			</>
		);
	if (
		typeof value === "string" &&
		/(At|From|Until|Date)$/.test(field) &&
		!Number.isNaN(Date.parse(value))
	)
		return <>{date(value, true)} WAT</>;
	return <>{String(value)}</>;
}
function mediaUrl(
	field: string,
	value: unknown,
	media: boolean,
): string | null {
	if (
		!media ||
		typeof value !== "string" ||
		!["url", "publicUrl", "secureUrl", "thumbnailUrl"].includes(field)
	)
		return null;
	try {
		const url = new URL(value);
		return ["http:", "https:"].includes(url.protocol) ? url.href : null;
	} catch {
		return null;
	}
}
function Fields({
	values,
	media = false,
}: {
	values: Record<string, unknown>;
	media?: boolean;
}) {
	return (
		<dl className="record-detail">
			{Object.entries(values).map(([key, value]) => (
				<div
					className={`detail-field${(value !== null && typeof value === "object") || key === "description" ? " detail-field-wide" : ""}`}
					key={key}
				>
					<dt>{label(key)}</dt>
					<dd>
						{mediaUrl(key, value, media) ? (
							<MediaLink
								url={mediaUrl(key, value, media) as string}
								title={
									typeof values.altText === "string"
										? values.altText
										: `${label(key)} media`
								}
								image={[
									"image/jpeg",
									"image/png",
									"image/webp",
									"image/gif",
									"image/avif",
								].includes(String(values.contentType || values.mimeType))}
							/>
						) : (
							<Value field={key} value={value} media={media} />
						)}
					</dd>
				</div>
			))}
		</dl>
	);
}
export function RecordDetail({
	record,
	resource,
}: {
	record: RecordItem;
	resource: Resource;
}) {
	const groups = sections[resource];
	const known = new Set(Object.values(groups).flat());
	const extra = Object.fromEntries(
		Object.entries(record).filter(([key]) => !known.has(key)),
	);
	return (
		<div className="detail-sections">
			{Object.entries({
				...groups,
				...(Object.keys(extra).length
					? { "Additional details": Object.keys(extra) }
					: {}),
			}).map(([title, fields]) => (
				<section className="panel detail-section" key={title}>
					<h2>{title}</h2>
					{fields.length === 1 && fields[0] === "paymentAttempts" ? (
						<Value field="paymentAttempts" value={record.paymentAttempts} />
					) : (
						<Fields
							values={Object.fromEntries(
								fields.map((key) => [key, record[key]]),
							)}
						/>
					)}
				</section>
			))}
		</div>
	);
}
