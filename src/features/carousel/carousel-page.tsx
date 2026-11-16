import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/features/admin/components";
import { errorMessage } from "@/features/live/api";
import { api } from "@/lib/api";
import "./carousel.css";

type CarouselImage = {
	id: string;
	publicUrl: string;
	altText: string;
	contentType: string;
	contentLength: number;
	createdAt: string;
};
const path = "/admin/carousel/images";
const key = ["admin", "carousel"];
const validFile = (file: File) =>
	["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
	file.size > 0 &&
	file.size <= 5 * 1024 * 1024;

export default function CarouselPage() {
	const client = useQueryClient();
	const [selection, setSelection] = useState<{
		file: File;
		url: string;
	} | null>(null);
	const [altText, setAltText] = useState("");
	const [validation, setValidation] = useState("");
	const [progress, setProgress] = useState<number | null>(null);
	const [removing, setRemoving] = useState<CarouselImage | null>(null);
	const [completionId, setCompletionId] = useState<string | null>(null);
	const submitting = useRef(false);
	const fileInput = useRef<HTMLInputElement>(null);
	useEffect(
		() => () => {
			if (selection) URL.revokeObjectURL(selection.url);
		},
		[selection],
	);
	const images = useQuery({
		queryKey: key,
		retry: false,
		staleTime: 0,
		refetchOnMount: "always",
		refetchOnWindowFocus: "always",
		queryFn: async ({ signal }) =>
			(await api.get<{ items: CarouselImage[] }>(path, { signal })).data.items,
	});
	const upload = useMutation({
		retry: false,
		mutationFn: async () => {
			if (
				!selection ||
				!validFile(selection.file) ||
				!altText.trim() ||
				altText.trim().length > 300
			)
				throw new Error(
					"Choose a JPEG, PNG or WebP up to 5 MiB and enter 1–300 characters of alt text.",
				);
			let imageId = completionId;
			if (!imageId) {
				const { file } = selection;
				const { data } = await api.post<{ imageId: string; uploadUrl: string }>(
					`${path}/upload-intent`,
					{
						altText: altText.trim(),
						contentType: file.type,
						contentLength: file.size,
					},
				);
				setProgress(0);
				// A separate client sends no application cookies or authorization to R2.
				await axios.put(data.uploadUrl, file, {
					withCredentials: false,
					timeout: 120000,
					headers: { "Content-Type": file.type },
					onUploadProgress: (event) =>
						setProgress(
							Math.round((event.loaded / (event.total || file.size)) * 100),
						),
				});
				imageId = data.imageId;
				setCompletionId(imageId);
			}
			setProgress(100);
			await api.post(`${path}/${encodeURIComponent(imageId)}/complete`);
		},
		onSuccess: async () => {
			setSelection(null);
			setAltText("");
			setCompletionId(null);
			setProgress(null);
			if (fileInput.current) fileInput.current.value = "";
			await client.invalidateQueries({ queryKey: key });
		},
		onSettled: () => {
			submitting.current = false;
		},
	});
	const remove = useMutation({
		retry: false,
		mutationFn: async (id: string) => {
			await api.delete(`${path}/${encodeURIComponent(id)}`);
		},
		onSuccess: () => setRemoving(null),
		onSettled: async () => {
			await client.invalidateQueries({ queryKey: key });
		},
	});
	function choose(file?: File) {
		if (submitting.current) return;
		upload.reset();
		setValidation("");
		setCompletionId(null);
		setProgress(null);
		if (!file || !validFile(file)) {
			setSelection(null);
			setValidation("Choose one JPEG, PNG or WebP image up to 5 MiB.");
			return;
		}
		setSelection({ file, url: URL.createObjectURL(file) });
	}
	return (
		<div className="carousel-page">
			<header className="page-header">
				<div>
					<p className="eyebrow">Jobs & media</p>
					<h1>Landing-page carousel</h1>
					<p>
						Images appear below the homepage hero, in upload order. Uploads
						publish immediately after verification.
					</p>
				</div>
			</header>
			<section className="panel carousel-upload" aria-labelledby="upload-title">
				<h2 id="upload-title">Add an image</h2>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						if (submitting.current) return;
						submitting.current = true;
						upload.mutate();
					}}
				>
					<fieldset disabled={upload.isPending}>
						<div className="form-field">
							<label htmlFor="carousel-file">Image</label>
							<input
								ref={fileInput}
								id="carousel-file"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								onChange={(event) => choose(event.target.files?.[0])}
							/>
							<p>
								JPEG, PNG or WebP, up to 5 MiB. Images fit within a 16:9 frame
								without cropping.
							</p>
						</div>
						{selection && (
							<img
								className="carousel-preview"
								src={selection.url}
								alt="Selected preview"
								onError={() => {
									setSelection(null);
									setValidation(
										"This image could not be previewed. Choose another image.",
									);
								}}
							/>
						)}
						<div className="form-field">
							<label htmlFor="carousel-alt">Alt text</label>
							<textarea
								id="carousel-alt"
								required
								maxLength={300}
								value={altText}
								disabled={Boolean(completionId)}
								onChange={(event) => setAltText(event.target.value)}
							/>
							<p>
								Describe the image for people using screen readers. 1–300
								characters.
							</p>
						</div>
					</fieldset>
					{validation && (
						<p role="alert" className="form-error">
							{validation}
						</p>
					)}
					{upload.isError && (
						<p role="alert" className="form-error">
							{errorMessage(upload.error)}{" "}
							{completionId
								? "The file uploaded. Retry publication, or start again if the upload expired."
								: "Check your connection and retry the upload."}
						</p>
					)}
					{progress !== null && (
						<div role="status">
							<progress
								max={100}
								value={progress}
								aria-label="Upload progress"
							/>{" "}
							{progress}% {progress === 100 && "— verifying publication"}
						</div>
					)}
					<div className="form-actions">
						<button
							className="button button-primary"
							type="submit"
							disabled={upload.isPending || !selection || !altText.trim()}
						>
							{upload.isPending
								? "Publishing…"
								: completionId
									? "Retry publication"
									: "Upload & publish"}
						</button>
						{completionId && !upload.isPending && (
							<button
								type="button"
								className="button"
								onClick={() => {
									setCompletionId(null);
									setProgress(null);
									upload.reset();
								}}
							>
								Start again
							</button>
						)}
					</div>
				</form>
			</section>
			<section
				className="panel carousel-library"
				aria-labelledby="published-title"
			>
				<h2 id="published-title">Published images</h2>
				{images.isPending && <p role="status">Loading images…</p>}
				{images.isError && (
					<div role="alert">
						<p>{errorMessage(images.error)}</p>
						<button
							className="button"
							type="button"
							onClick={() => images.refetch()}
						>
							Retry loading images
						</button>
					</div>
				)}
				{images.data?.length === 0 && <p>No carousel images yet.</p>}
				<ol className="carousel-library-list">
					{images.data?.map((image, index) => (
						<li key={image.id}>
							<img src={image.publicUrl} alt={image.altText} />
							<div>
								<strong>
									{index + 1}. {image.altText}
								</strong>
								<p>
									{image.contentType} ·{" "}
									{(image.contentLength / 1024).toFixed(0)} KiB
								</p>
							</div>
							<button
								className="button"
								type="button"
								onClick={() => {
									remove.reset();
									setRemoving(image);
								}}
							>
								Remove
							</button>
						</li>
					))}
				</ol>
			</section>
			<Modal
				open={Boolean(removing)}
				onClose={() => {
					if (!remove.isPending) setRemoving(null);
				}}
				title="Remove carousel image?"
				description="The image will leave the homepage immediately. You can upload it again later."
			>
				<p>{removing?.altText}</p>
				{remove.isError && (
					<p role="alert" className="form-error">
						{errorMessage(remove.error)} The image may already be hidden. Retry
						removal to finish deleting the file.
					</p>
				)}
				<div className="form-actions">
					<button
						className="button"
						type="button"
						disabled={remove.isPending}
						onClick={() => setRemoving(null)}
					>
						Cancel
					</button>
					<button
						className="button button-primary"
						type="button"
						disabled={remove.isPending}
						onClick={() => {
							if (removing && !remove.isPending) remove.mutate(removing.id);
						}}
					>
						{remove.isPending ? "Removing…" : "Confirm removal"}
					</button>
				</div>
			</Modal>
		</div>
	);
}
