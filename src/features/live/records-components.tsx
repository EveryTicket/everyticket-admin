import { Link } from "react-router-dom";
import { Badge } from "@/features/admin/components";
import type { Page, RecordItem, Resource } from "./contracts";
import { resources } from "./contracts";
import { presentRecord } from "./record-presentation";

type FilterUpdate = (key: string, value: string) => void;
export function RecordFilters({
	resource,
	search,
	update,
}: {
	resource: Resource;
	search: URLSearchParams;
	update: FilterUpdate;
}) {
	const config = resources[resource];
	return (
		<div className="table-toolbar">
			{(resource === "users" || resource === "orders") && (
				<input
					aria-label="Search records"
					placeholder="Search records…"
					value={search.get("q") || ""}
					onChange={(event) => update("q", event.target.value)}
				/>
			)}
			{config.statuses.length > 0 && (
				<select
					aria-label="Status"
					value={search.get("status") || ""}
					onChange={(event) => update("status", event.target.value)}
				>
					<option value="">All statuses</option>
					{config.statuses.map((status) => (
						<option key={status}>{status}</option>
					))}
				</select>
			)}
		</div>
	);
}
export function RecordPagination({
	data,
	onPage,
}: {
	data: Page | undefined;
	onPage: (page: number) => void;
}) {
	return (
		<div className="table-toolbar">
			<span>{data?.total || 0} records</span>
			<button
				type="button"
				className="button"
				disabled={(data?.page || 1) <= 1}
				onClick={() => onPage((data?.page || 1) - 1)}
			>
				Previous
			</button>
			<button
				type="button"
				className="button"
				disabled={!data || data.page * data.pageSize >= data.total}
				onClick={() => onPage((data?.page || 1) + 1)}
			>
				Next
			</button>
		</div>
	);
}
function RecordRow({
	row,
	resource,
	href,
}: {
	row: RecordItem;
	resource: Resource;
	href: string;
}) {
	const view = presentRecord(resource, row);
	return (
		<tr>
			<td data-label="Record">
				<strong>{view.title}</strong>
				<p>{view.subtitle}</p>
			</td>
			<td data-label="Status">
				<Badge status={view.status} />
			</td>
			<td data-label="Amount / detail">
				<span className="mobile-field-label">Amount / detail</span>
				{view.amount}
			</td>
			<td data-label="Date (WAT)">
				<span className="mobile-field-label">Date (WAT)</span>
				{view.date}
			</td>
			<td>
				<Link className="text-link" to={href}>
					View details
				</Link>
			</td>
		</tr>
	);
}
export function RecordsTable({
	items,
	resource,
	detailUrl,
}: {
	items: RecordItem[];
	resource: Resource;
	detailUrl: (id: string) => string;
}) {
	return (
		<table className="collection-table">
			<thead>
				<tr>
					<th scope="col">Record</th>
					<th scope="col">Status</th>
					<th scope="col">Amount / detail</th>
					<th scope="col">Date (WAT)</th>
					<th />
				</tr>
			</thead>
			<tbody>
				{items.map((row) => (
					<RecordRow
						key={row.id}
						row={row}
						resource={resource}
						href={detailUrl(row.id)}
					/>
				))}
			</tbody>
		</table>
	);
}
