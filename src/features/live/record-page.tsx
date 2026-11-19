import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge, Modal } from "@/features/admin/components";
import { ActionForm } from "./action-form";
import { type Action, actionsFor } from "./actions";
import { errorMessage, fetchRecord } from "./api";
import {
	type Page,
	type RecordItem,
	type Resource,
	resources,
} from "./contracts";
import { RecordDetail } from "./record-detail";
import { presentRecord } from "./record-presentation";
import { api } from "@/lib/api";
import { date, money } from "@/features/admin/format";
import { actionConsequence } from "./actions";
import { statusLabel } from "./status";

export default function RecordPage({ resource }: { resource: Resource }) {
	const { id = "" } = useParams();
	// Remount confirmation state when moving between records of the same resource.
	return <Details key={id} resource={resource} id={id} />;
}
function Details({ resource, id }: { resource: Resource; id: string }) {
	const [pending, setPending] = useState(false);
	const [search] = useSearchParams();
	const from = search.get("from");
	const origin = from === null ? undefined : new URLSearchParams(from);
	origin?.delete("record");
	const client = useQueryClient();
	const [action, setAction] = useState<{
		item: Action;
		updatedAt: number;
	} | null>(null);
	const query = useQuery<RecordItem | null>({
		queryKey: ["admin", resource, "detail", id],
		queryFn: ({ signal }) => fetchRecord(resource, id, signal),
		placeholderData: () =>
			client
				.getQueriesData<Page>({
					queryKey: ["admin", resource],
					predicate: (query) =>
						query.queryKey.length === 3 &&
						typeof query.queryKey[2] === "object",
				})
				.flatMap(([, page]) => page?.items || [])
				.find((row) => row.id === id),
		staleTime: 0,
		refetchOnMount: "always",
		retry: false,
	});
	const activeRule = useQuery<RecordItem | null>({
		queryKey: ["admin", "fee-rules", "active"],
		enabled: resource === "fee-rules" && Boolean(action),
		queryFn: async ({ signal }) =>
			(await api.get<RecordItem | null>("/admin/platform-fee-rule", { signal }))
				.data,
		staleTime: 0,
		retry: false,
	});
	const row = query.data;
	const ready =
		query.isSuccess && !query.isPlaceholderData && !query.isFetching;
	return (
		<>
			<Link
				className="text-link"
				to={`/${resource}${origin?.size ? `?${origin}` : ""}`}
			>
				← Back to {resources[resource].title}
			</Link>
			<div className="page-heading record-heading">
				<div>
					<p className="eyebrow">{resources[resource].title} · Details</p>
					<h1>
						{row?.title ||
							row?.user?.name ||
							row?.reference ||
							row?.action ||
							(row?.version !== undefined
								? `Version ${row.version}`
								: `${resource === "refunds" ? "Refund request" : resource === "payouts" ? "Payout request" : "Record"} ${id}`)}
					</h1>
					<p className="record-id">{id}</p>
					{row && (
						<Badge
							status={statusLabel(
								row.status ||
									row.role ||
									(resource === "fee-rules" ? "Recorded version" : "Recorded"),
							)}
						/>
					)}
				</div>
				<div className="detail-actions">
					{row &&
						actionsFor(resource, row).map((item) => (
							<button
								key={item.label}
								type="button"
								className="button button-primary"
								disabled={!ready}
								onClick={() =>
									setAction({ item, updatedAt: query.dataUpdatedAt })
								}
							>
								{item.label}
							</button>
						))}
				</div>
			</div>
			{query.isFetching && <p role="status">Loading fresh record details…</p>}
			{query.isError && (
				<div className="panel records-state records-state-error" role="alert">
					<p>{errorMessage(query.error)}</p>
					<button
						type="button"
						className="button"
						onClick={() => query.refetch()}
					>
						Try again
					</button>
				</div>
			)}
			{ready && !row && (
				<div className="panel records-state">
					This record is unavailable. It could not be found.
				</div>
			)}
			{row && <RecordDetail record={row} resource={resource} />}
			{action && (
				<Modal
					open
					pending={pending}
					title={action.item.label}
					onClose={() => {
						if (!pending) setAction(null);
					}}
				>
					{row && (
						<div className="action-context">
							<strong>{presentRecord(resource, row).title}</strong>
							<p>{row.id}</p>
							<p>{row.event?.title || row.user?.email || row.buyerEmail}</p>
							{row.organizer && <p>Organizer: {row.organizer.user.name}</p>}
							<p>{row.order?.reference || row.reference}</p>
							{Object.entries(row)
								.filter(
									([key, value]) =>
										key.endsWith("Kobo") && typeof value === "number",
								)
								.map(([key, value]) => (
									<p key={key}>
										{key
											.replace(/Kobo$/, "")
											.replace(/([a-z])([A-Z])/g, "$1 $2")}
										: {money(value as number)}
									</p>
								))}
							{resource === "fee-rules" && (
								<p>
									Selected version {row.version}:{" "}
									{row.mode === "FIXED"
										? money(row.fixedAmountKobo || 0)
										: `${(row.percentageBasisPoints || 0) / 100}%`}
									. This operation replaces the global active rule.
									{activeRule.isPending
										? " Loading active rule…"
										: activeRule.isError
											? " Active rule context could not be loaded. Close and reopen to retry."
											: activeRule.data
												? ` Active rule: version ${activeRule.data.version} (${activeRule.data.id}), ${activeRule.data.mode === "FIXED" ? money(activeRule.data.fixedAmountKobo || 0) : `${(activeRule.data.percentageBasisPoints || 0) / 100}%`}${activeRule.data.activeFrom ? `, effective ${date(activeRule.data.activeFrom, true)} WAT` : ""}.`
												: " There is no active fee rule."}
								</p>
							)}
						</div>
					)}
					<p className="action-intro">{actionConsequence(action.item)}</p>
					<ActionForm
						key={action.item.path}
						action={action.item}
						onPendingChange={setPending}
						available={ready && action.updatedAt === query.dataUpdatedAt}
						close={() => setAction(null)}
					/>
				</Modal>
			)}
		</>
	);
}
