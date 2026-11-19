import { Spinner } from "@/components/ui/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import { money } from "@/features/admin/format";
import { type Action, actionBody, actionFieldLabels } from "./actions";
import { errorMessage } from "./api";
export function ActionForm({
	action,
	close,
	onSuccess,
	onPendingChange,
	available = true,
}: {
	action: Action;
	close: () => void;
	onSuccess?: (data: unknown) => void;
	onPendingChange: (pending: boolean) => void;
	available?: boolean;
}) {
	const {
		register,
		handleSubmit,
		watch,
		formState: { errors },
	} = useForm<Record<string, string>>({
		defaultValues: action.fields.includes("mode") ? { mode: "FIXED" } : {},
	});
	const prefix = useId();
	const inFlight = useRef(false);
	const mode = watch("mode");
	const feeValue = watch("feeValue");
	const validFee =
		feeValue?.trim() &&
		Number.isSafeInteger(Number(feeValue)) &&
		Number(feeValue) >= 0;
	const client = useQueryClient();
	const mutation = useMutation({
		mutationFn: (values: Record<string, string>) =>
			api.request({
				url: action.path,
				method: action.method,
				data: actionBody(action, values),
			}),
		onSuccess: async (response) => {
			toast.success(action.successMessage);
			onSuccess?.(response.data);
			await client.invalidateQueries({ queryKey: ["admin"] });
			close();
		},
		onError: (error) => toast.error(errorMessage(error)),
		onSettled: () => {
			inFlight.current = false;
			onPendingChange(false);
		},
	});
	// Clear the owner's pending state if successful closure unmounts the form.
	useEffect(() => () => onPendingChange(false), [onPendingChange]);
	return (
		<form
			className="action-form"
			noValidate
			onSubmit={handleSubmit((values) => {
				if (inFlight.current || !available) return;
				inFlight.current = true;
				onPendingChange(true);
				mutation.mutate(values);
			})}
		>
			{action.fields.map((field) => {
				const numeric = field.endsWith("Kobo") || field === "feeValue";
				const date = field === "effectiveAt" || field === "transferDate";
				const label =
					field === "feeValue"
						? mode === "PERCENTAGE"
							? "Percentage (basis points)"
							: "Fixed amount (kobo)"
						: actionFieldLabels[field];
				const id = `${prefix}-${field}`;
				const helper = field === "feeValue";
				const accessibility = {
					id,
					"aria-invalid": Boolean(errors[field]),
					"aria-describedby":
						[helper ? `${id}-help` : "", errors[field] ? `${id}-error` : ""]
							.filter(Boolean)
							.join(" ") || undefined,
				};
				const registration = register(field, {
					required: `Enter ${label.toLowerCase()}.`,
					validate: (value) => {
						if (!value.trim()) return `Enter ${label.toLowerCase()}.`;
						if (
							numeric &&
							(!Number.isSafeInteger(Number(value)) || Number(value) < 0)
						)
							return `Enter a whole non-negative ${field === "feeValue" && mode === "PERCENTAGE" ? "basis point" : "kobo"} amount.`;
						if (date && Number.isNaN(Date.parse(`${value}+01:00`)))
							return "Enter a valid date and time in Africa/Lagos.";
						return true;
					},
				});
				return (
					<div className="form-field" key={field}>
						<label htmlFor={id}>{label}</label>
						{field === "mode" ? (
							<select
								{...accessibility}
								{...registration}
								disabled={mutation.isPending}
							>
								<option value="FIXED">Fixed</option>
								<option value="PERCENTAGE">Percentage</option>
							</select>
						) : (
							<input
								{...accessibility}
								{...registration}
								readOnly={mutation.isPending}
								type={numeric ? "number" : date ? "datetime-local" : "text"}
								min={numeric ? 0 : undefined}
								step={numeric ? 1 : undefined}
							/>
						)}
						{helper && (
							<p id={`${id}-help`} className="field-help" aria-live="polite">
								{mode === "PERCENTAGE"
									? "250 basis points = 2.5%."
									: "250 kobo = ₦2.50."}{" "}
								Preview:{" "}
								{validFee
									? mode === "PERCENTAGE"
										? `${Number(feeValue) / 100}%`
										: money(Number(feeValue))
									: "Enter a whole non-negative value."}
							</p>
						)}
						{errors[field] && (
							<span id={`${id}-error`} className="field-error" role="alert">
								{String(errors[field]?.message)}
							</span>
						)}
					</div>
				);
			})}
			{mutation.isError && (
				<p id={`${prefix}-server-error`} className="form-error" role="alert">
					{errorMessage(mutation.error)}
				</p>
			)}
			{!available && !mutation.isPending && (
				<p role="status">
					Record details have changed. Close this dialog and review the latest
					record before continuing.
				</p>
			)}
			<div className="form-actions">
				<button
					type="button"
					className="button"
					disabled={mutation.isPending}
					onClick={() => {
						if (!inFlight.current) close();
					}}
				>
					Cancel
				</button>
				<button
					type="submit"
					className="button button-primary"
					disabled={mutation.isPending || !available}
				>
					{mutation.isPending && <Spinner aria-hidden="true" />}
					{mutation.isPending ? "Saving…" : action.label}
				</button>
			</div>
		</form>
	);
}
