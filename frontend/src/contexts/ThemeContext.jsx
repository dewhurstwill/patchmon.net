import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { userPreferencesAPI } from "../utils/api";

const ThemeContext = createContext();

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
};

export const ThemeProvider = ({ children }) => {
	const [theme, setTheme] = useState(() => {
		// Check localStorage first for immediate render
		const savedTheme = localStorage.getItem("theme");
		if (savedTheme) {
			return savedTheme;
		}
		// Check system preference
		if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
			return "dark";
		}
		return "light";
	});

	// Fetch user preferences from backend
	const { data: userPreferences } = useQuery({
		queryKey: ["userPreferences"],
		queryFn: () => userPreferencesAPI.get().then((res) => res.data),
		retry: 1,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	// Sync with user preferences from backend
	useEffect(() => {
		if (userPreferences?.theme_preference) {
			setTheme(userPreferences.theme_preference);
			localStorage.setItem("theme", userPreferences.theme_preference);
		}
	}, [userPreferences]);

	useEffect(() => {
		// Apply theme to document
		if (theme === "dark") {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}

		// Save to localStorage
		localStorage.setItem("theme", theme);
	}, [theme]);

	const toggleTheme = async () => {
		const newTheme = theme === "light" ? "dark" : "light";
		setTheme(newTheme);

		// Save to backend
		try {
			await userPreferencesAPI.update({ theme_preference: newTheme });
		} catch (error) {
			console.error("Failed to save theme preference:", error);
			// Theme is already set locally, so user still sees the change
		}
	};

	const value = {
		theme,
		toggleTheme,
		isDark: theme === "dark",
	};

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
};
