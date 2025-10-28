import { createContext, useContext, useEffect, useState } from "react";

const ColorThemeContext = createContext();

// Theme configurations matching the login backgrounds
export const THEME_PRESETS = {
	default: {
		name: "Normal Dark",
		login: {
			cellSize: 90,
			variance: 0.85,
			xColors: ["#0f172a", "#1e293b", "#334155", "#475569", "#64748b"],
			yColors: ["#0f172a", "#1e293b", "#334155", "#475569", "#64748b"],
		},
		app: {
			bgPrimary: "#1e293b",
			bgSecondary: "#1e293b",
			bgTertiary: "#334155",
			borderColor: "#475569",
			cardBg: "#1e293b",
			cardBorder: "#334155",
			buttonBg: "#334155",
			buttonHover: "#475569",
		},
	},
	cyber_blue: {
		name: "Cyber Blue",
		login: {
			cellSize: 90,
			variance: 0.85,
			xColors: ["#0a0820", "#1a1f3a", "#2d3561", "#4a5584", "#667eaf"],
			yColors: ["#0a0820", "#1a1f3a", "#2d3561", "#4a5584", "#667eaf"],
		},
		app: {
			bgPrimary: "#0a0820",
			bgSecondary: "#1a1f3a",
			bgTertiary: "#2d3561",
			borderColor: "#4a5584",
			cardBg: "#1a1f3a",
			cardBorder: "#2d3561",
			buttonBg: "#2d3561",
			buttonHover: "#4a5584",
		},
	},
	neon_purple: {
		name: "Neon Purple",
		login: {
			cellSize: 80,
			variance: 0.9,
			xColors: ["#0f0a1e", "#1e0f3e", "#4a0082", "#7209b7", "#b5179e"],
			yColors: ["#0f0a1e", "#1e0f3e", "#4a0082", "#7209b7", "#b5179e"],
		},
		app: {
			bgPrimary: "#0f0a1e",
			bgSecondary: "#1e0f3e",
			bgTertiary: "#4a0082",
			borderColor: "#7209b7",
			cardBg: "#1e0f3e",
			cardBorder: "#4a0082",
			buttonBg: "#4a0082",
			buttonHover: "#7209b7",
		},
	},
	matrix_green: {
		name: "Matrix Green",
		login: {
			cellSize: 70,
			variance: 0.7,
			xColors: ["#001a00", "#003300", "#004d00", "#006600", "#00b300"],
			yColors: ["#001a00", "#003300", "#004d00", "#006600", "#00b300"],
		},
		app: {
			bgPrimary: "#001a00",
			bgSecondary: "#003300",
			bgTertiary: "#004d00",
			borderColor: "#006600",
			cardBg: "#003300",
			cardBorder: "#004d00",
			buttonBg: "#004d00",
			buttonHover: "#006600",
		},
	},
	ocean_blue: {
		name: "Ocean Blue",
		login: {
			cellSize: 85,
			variance: 0.8,
			xColors: ["#001845", "#023e7d", "#0077b6", "#0096c7", "#00b4d8"],
			yColors: ["#001845", "#023e7d", "#0077b6", "#0096c7", "#00b4d8"],
		},
		app: {
			bgPrimary: "#001845",
			bgSecondary: "#023e7d",
			bgTertiary: "#0077b6",
			borderColor: "#0096c7",
			cardBg: "#023e7d",
			cardBorder: "#0077b6",
			buttonBg: "#0077b6",
			buttonHover: "#0096c7",
		},
	},
	sunset_gradient: {
		name: "Sunset Gradient",
		login: {
			cellSize: 95,
			variance: 0.75,
			xColors: ["#1a0033", "#330066", "#4d0099", "#6600cc", "#9933ff"],
			yColors: ["#1a0033", "#660033", "#990033", "#cc0066", "#ff0099"],
		},
		app: {
			bgPrimary: "#1a0033",
			bgSecondary: "#330066",
			bgTertiary: "#4d0099",
			borderColor: "#6600cc",
			cardBg: "#330066",
			cardBorder: "#4d0099",
			buttonBg: "#4d0099",
			buttonHover: "#6600cc",
		},
	},
};

export const ColorThemeProvider = ({ children }) => {
	const [colorTheme, setColorTheme] = useState("default");
	const [isLoading, setIsLoading] = useState(true);

	// Fetch theme from settings on mount
	useEffect(() => {
		const fetchTheme = async () => {
			try {
				// Check localStorage first for unauthenticated pages (login)
				const cachedTheme = localStorage.getItem("colorTheme");
				if (cachedTheme) {
					setColorTheme(cachedTheme);
				}

				// Try to fetch from API (will fail on login page, that's ok)
				try {
					const token = localStorage.getItem("token");
					if (token) {
						const response = await fetch("/api/v1/settings", {
							headers: {
								Authorization: `Bearer ${token}`,
							},
						});

						if (response.ok) {
							const data = await response.json();
							if (data.color_theme) {
								setColorTheme(data.color_theme);
								localStorage.setItem("colorTheme", data.color_theme);
							}
						}
					}
				} catch (_apiError) {
					// Silent fail - use cached or default theme
					console.log("Could not fetch theme from API, using cached/default");
				}
			} catch (error) {
				console.error("Error loading color theme:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchTheme();
	}, []);

	const updateColorTheme = (theme) => {
		setColorTheme(theme);
		localStorage.setItem("colorTheme", theme);
	};

	const value = {
		colorTheme,
		setColorTheme: updateColorTheme,
		themeConfig: THEME_PRESETS[colorTheme] || THEME_PRESETS.default,
		isLoading,
	};

	return (
		<ColorThemeContext.Provider value={value}>
			{children}
		</ColorThemeContext.Provider>
	);
};

export const useColorTheme = () => {
	const context = useContext(ColorThemeContext);
	if (!context) {
		throw new Error("useColorTheme must be used within ColorThemeProvider");
	}
	return context;
};
