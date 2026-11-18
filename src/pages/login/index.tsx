import { Spinner } from "@/components/ui/spinner";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Brand } from "@/features/admin/components";
import { errorMessage } from "@/features/live/api";
import { api } from "@/lib/api";

export default function Login() {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();
	function reportError(message: string) {
		setError(message);
		toast.error(message);
	}
	const { register, handleSubmit } = useForm<{
		email: string;
		password: string;
	}>();
	return (
		<main className="login-screen">
			<div className="login-story">
				<Brand />
				<div>
					<span className="eyebrow">For the people behind the moments</span>
					<h1>
						Good experiences.
						<br />
						Great oversight.
					</h1>
					<p>Your place to keep Everyticket running beautifully.</p>
				</div>
				<span>Everyticket administration · 2026</span>
			</div>
			<div className="login-panel">
				<span className="login-lock">
					<LockKeyhole size={25} />
				</span>
				<p className="eyebrow">Platform administration</p>
				<h1>Welcome back.</h1>
				<p>Sign in with your administrator account.</p>
				<form
					onSubmit={handleSubmit(async (fields) => {
						setPending(true);
						setError("");
						try {
							await api.post("/admin/sign-in", {
								email: fields.email,
								password: fields.password,
							});
							toast.success("Signed in successfully.");
							navigate("/overview", { replace: true });
						} catch (error) {
							reportError(errorMessage(error));
						} finally {
							setPending(false);
						}
					})}
				>
					<label className="form-field">
						Email address
						<input
							{...register("email", { required: true })}
							type="email"
							required
							autoComplete="username"
							placeholder="you@everyticket.ng"
						/>
					</label>
					<label className="form-field">
						Password
						<input
							{...register("password", { required: true })}
							type="password"
							required
							autoComplete="current-password"
							placeholder="Your password"
						/>
					</label>
					{error && (
						<p className="form-error" role="alert">
							{error}
						</p>
					)}
					<button
						type="submit"
						className="button button-primary"
						disabled={pending}
					>
						{pending ? "Signing in…" : "Sign in"}
						{pending ? (
							<Spinner aria-hidden="true" />
						) : (
							<ArrowRight size={16} />
						)}
					</button>
				</form>
				<p className="login-caption">
					Administrator access is provisioned by Everyticket.
				</p>
			</div>
		</main>
	);
}
