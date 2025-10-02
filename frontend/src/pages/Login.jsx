import {
	AlertCircle,
	ArrowLeft,
	Eye,
	EyeOff,
	Lock,
	Mail,
	Smartphone,
	User,
} from "lucide-react";

import { useEffect, useId, useState } from "react";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authAPI } from "../utils/api";

const Login = () => {
	const usernameId = useId();
	const firstNameId = useId();
	const lastNameId = useId();
	const emailId = useId();
	const passwordId = useId();
	const tokenId = useId();
	const { login, setAuthState } = useAuth();
	const [isSignupMode, setIsSignupMode] = useState(false);
	const [formData, setFormData] = useState({
		username: "",
		email: "",
		password: "",
		firstName: "",
		lastName: "",
	});
	const [tfaData, setTfaData] = useState({
		token: "",
	});
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [requiresTfa, setRequiresTfa] = useState(false);
	const [tfaUsername, setTfaUsername] = useState("");
	const [signupEnabled, setSignupEnabled] = useState(false);

	const navigate = useNavigate();

	// Check if signup is enabled
	useEffect(() => {
		const checkSignupEnabled = async () => {
			try {
				const response = await fetch("/api/v1/auth/signup-enabled");
				if (response.ok) {
					const data = await response.json();
					setSignupEnabled(data.signupEnabled);
				}
			} catch (error) {
				console.error("Failed to check signup status:", error);
				// Default to disabled on error for security
				setSignupEnabled(false);
			}
		};
		checkSignupEnabled();
	}, []);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			// Use the AuthContext login function which handles everything
			const result = await login(formData.username, formData.password);

			if (result.requiresTfa) {
				setRequiresTfa(true);
				setTfaUsername(formData.username);
				setError("");
			} else if (result.success) {
				navigate("/");
			} else {
				setError(result.error || "Login failed");
			}
		} catch (err) {
			setError(err.response?.data?.error || "Login failed");
		} finally {
			setIsLoading(false);
		}
	};

	const handleSignupSubmit = async (e) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const response = await authAPI.signup(
				formData.username,
				formData.email,
				formData.password,
				formData.firstName,
				formData.lastName,
			);
			if (response.data?.token) {
				// Update AuthContext state and localStorage
				setAuthState(response.data.token, response.data.user);

				// Redirect to dashboard
				navigate("/");
			} else {
				setError("Signup failed - invalid response");
			}
		} catch (err) {
			console.error("Signup error:", err);
			const errorMessage =
				err.response?.data?.error ||
				(err.response?.data?.errors && err.response.data.errors.length > 0
					? err.response.data.errors.map((e) => e.msg).join(", ")
					: err.message || "Signup failed");
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	const handleTfaSubmit = async (e) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const response = await authAPI.verifyTfa(tfaUsername, tfaData.token);

			if (response.data?.token) {
				// Update AuthContext with the new authentication state
				setAuthState(response.data.token, response.data.user);

				// Redirect to dashboard
				navigate("/");
			} else {
				setError("TFA verification failed - invalid response");
			}
		} catch (err) {
			console.error("TFA verification error:", err);
			const errorMessage =
				err.response?.data?.error || err.message || "TFA verification failed";
			setError(errorMessage);
			// Clear the token input for security
			setTfaData({ token: "" });
		} finally {
			setIsLoading(false);
		}
	};

	const handleInputChange = (e) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
	};

	const handleTfaInputChange = (e) => {
		setTfaData({
			...tfaData,
			[e.target.name]: e.target.value.replace(/\D/g, "").slice(0, 6),
		});
		// Clear error when user starts typing
		if (error) {
			setError("");
		}
	};

	const handleBackToLogin = () => {
		setRequiresTfa(false);
		setTfaData({ token: "" });
		setError("");
	};

	const toggleMode = () => {
		// Only allow signup mode if signup is enabled
		if (!signupEnabled && !isSignupMode) {
			return; // Don't allow switching to signup if disabled
		}
		setIsSignupMode(!isSignupMode);
		setFormData({
			username: "",
			email: "",
			password: "",
			firstName: "",
			lastName: "",
		});
		setError("");
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				<div>
					<div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100">
						<Lock size={24} color="#2563eb" strokeWidth={2} />
					</div>
					<h2 className="mt-6 text-center text-3xl font-extrabold text-secondary-900">
						{isSignupMode ? "Create PatchMon Account" : "Sign in to PatchMon"}
					</h2>
					<p className="mt-2 text-center text-sm text-secondary-600">
						Monitor and manage your Linux package updates
					</p>
				</div>

				{!requiresTfa ? (
					<form
						className="mt-8 space-y-6"
						onSubmit={isSignupMode ? handleSignupSubmit : handleSubmit}
					>
						<div className="space-y-4">
							<div>
								<label
									htmlFor={usernameId}
									className="block text-sm font-medium text-secondary-700"
								>
									{isSignupMode ? "Username" : "Username or Email"}
								</label>
								<div className="mt-1 relative">
									<input
										id={usernameId}
										name="username"
										type="text"
										required
										value={formData.username}
										onChange={handleInputChange}
										className="appearance-none rounded-md relative block w-full pl-10 pr-3 py-2 border border-secondary-300 placeholder-secondary-500 text-secondary-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
										placeholder={
											isSignupMode
												? "Enter your username"
												: "Enter your username or email"
										}
									/>
									<div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-20 flex items-center">
										<User size={20} color="#64748b" strokeWidth={2} />
									</div>
								</div>
							</div>

							{isSignupMode && (
								<>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label
												htmlFor={firstNameId}
												className="block text-sm font-medium text-secondary-700"
											>
												First Name
											</label>
											<div className="mt-1 relative">
												<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
													<User className="h-5 w-5 text-secondary-400" />
												</div>
												<input
													id={firstNameId}
													name="firstName"
													type="text"
													required
													value={formData.firstName}
													onChange={handleInputChange}
													className="appearance-none rounded-md relative block w-full pl-10 pr-3 py-2 border border-secondary-300 placeholder-secondary-500 text-secondary-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
													placeholder="Enter your first name"
												/>
											</div>
										</div>
										<div>
											<label
												htmlFor={lastNameId}
												className="block text-sm font-medium text-secondary-700"
											>
												Last Name
											</label>
											<div className="mt-1 relative">
												<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
													<User className="h-5 w-5 text-secondary-400" />
												</div>
												<input
													id={lastNameId}
													name="lastName"
													type="text"
													required
													value={formData.lastName}
													onChange={handleInputChange}
													className="appearance-none rounded-md relative block w-full pl-10 pr-3 py-2 border border-secondary-300 placeholder-secondary-500 text-secondary-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
													placeholder="Enter your last name"
												/>
											</div>
										</div>
									</div>
									<div>
										<label
											htmlFor={emailId}
											className="block text-sm font-medium text-secondary-700"
										>
											Email
										</label>
										<div className="mt-1 relative">
											<input
												id={emailId}
												name="email"
												type="email"
												required
												value={formData.email}
												onChange={handleInputChange}
												className="appearance-none rounded-md relative block w-full pl-10 pr-3 py-2 border border-secondary-300 placeholder-secondary-500 text-secondary-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
												placeholder="Enter your email"
											/>
											<div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-20 flex items-center">
												<Mail size={20} color="#64748b" strokeWidth={2} />
											</div>
										</div>
									</div>
								</>
							)}

							<div>
								<label
									htmlFor={passwordId}
									className="block text-sm font-medium text-secondary-700"
								>
									Password
								</label>
								<div className="mt-1 relative">
									<input
										id={passwordId}
										name="password"
										type={showPassword ? "text" : "password"}
										required
										value={formData.password}
										onChange={handleInputChange}
										className="appearance-none rounded-md relative block w-full pl-10 pr-10 py-2 border border-secondary-300 placeholder-secondary-500 text-secondary-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
										placeholder="Enter your password"
									/>
									<div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-20 flex items-center">
										<Lock size={20} color="#64748b" strokeWidth={2} />
									</div>
									<div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center">
										<button
											type="button"
											onClick={() => setShowPassword(!showPassword)}
											className="bg-transparent border-none cursor-pointer p-1 flex items-center justify-center"
										>
											{showPassword ? (
												<EyeOff size={20} color="#64748b" strokeWidth={2} />
											) : (
												<Eye size={20} color="#64748b" strokeWidth={2} />
											)}
										</button>
									</div>
								</div>
							</div>
						</div>

						{error && (
							<div className="bg-danger-50 border border-danger-200 rounded-md p-3">
								<div className="flex">
									<AlertCircle size={20} color="#dc2626" strokeWidth={2} />
									<div className="ml-3">
										<p className="text-sm text-danger-700">{error}</p>
									</div>
								</div>
							</div>
						)}

						<div>
							<button
								type="submit"
								disabled={isLoading}
								className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isLoading ? (
									<div className="flex items-center">
										<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
										{isSignupMode ? "Creating account..." : "Signing in..."}
									</div>
								) : isSignupMode ? (
									"Create Account"
								) : (
									"Sign in"
								)}
							</button>
						</div>

						{signupEnabled && (
							<div className="text-center">
								<p className="text-sm text-secondary-600">
									{isSignupMode
										? "Already have an account?"
										: "Don't have an account?"}{" "}
									<button
										type="button"
										onClick={toggleMode}
										className="font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus:underline"
									>
										{isSignupMode ? "Sign in" : "Sign up"}
									</button>
								</p>
							</div>
						)}
					</form>
				) : (
					<form className="mt-8 space-y-6" onSubmit={handleTfaSubmit}>
						<div className="text-center">
							<div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
								<Smartphone size={24} color="#2563eb" strokeWidth={2} />
							</div>
							<h3 className="mt-4 text-lg font-medium text-secondary-900">
								Two-Factor Authentication
							</h3>
							<p className="mt-2 text-sm text-secondary-600">
								Enter the 6-digit code from your authenticator app
							</p>
						</div>

						<div>
							<label
								htmlFor={tokenId}
								className="block text-sm font-medium text-secondary-700"
							>
								Verification Code
							</label>
							<div className="mt-1">
								<input
									id={tokenId}
									name="token"
									type="text"
									required
									value={tfaData.token}
									onChange={handleTfaInputChange}
									className="appearance-none rounded-md relative block w-full px-3 py-2 border border-secondary-300 placeholder-secondary-500 text-secondary-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm text-center text-lg font-mono tracking-widest"
									placeholder="000000"
									maxLength="6"
								/>
							</div>
						</div>

						{error && (
							<div className="bg-danger-50 border border-danger-200 rounded-md p-3">
								<div className="flex">
									<AlertCircle size={20} color="#dc2626" strokeWidth={2} />
									<div className="ml-3">
										<p className="text-sm text-danger-700">{error}</p>
									</div>
								</div>
							</div>
						)}

						<div className="space-y-3">
							<button
								type="submit"
								disabled={isLoading || tfaData.token.length !== 6}
								className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isLoading ? (
									<div className="flex items-center">
										<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
										Verifying...
									</div>
								) : (
									"Verify Code"
								)}
							</button>

							<button
								type="button"
								onClick={handleBackToLogin}
								className="group relative w-full flex justify-center py-2 px-4 border border-secondary-300 text-sm font-medium rounded-md text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 items-center gap-2"
							>
								<ArrowLeft size={16} color="#475569" strokeWidth={2} />
								Back to Login
							</button>
						</div>

						<div className="text-center">
							<p className="text-sm text-secondary-600">
								Don't have access to your authenticator? Use a backup code.
							</p>
						</div>
					</form>
				)}
			</div>
		</div>
	);
};

export default Login;
