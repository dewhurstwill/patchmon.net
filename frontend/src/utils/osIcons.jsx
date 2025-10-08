import { Monitor, Server } from "lucide-react";
import { DiWindows } from "react-icons/di";
// Import OS icons from react-icons
import {
	SiAlpinelinux,
	SiArchlinux,
	SiCentos,
	SiDebian,
	SiFedora,
	SiLinux,
	SiMacos,
	SiUbuntu,
} from "react-icons/si";

/**
 * OS Icon mapping utility
 * Maps operating system types to appropriate react-icons components
 */
export const getOSIcon = (osType) => {
	if (!osType) return Monitor;

	const os = osType.toLowerCase();

	// Linux distributions with authentic react-icons
	if (os.includes("ubuntu")) return SiUbuntu;
	if (os.includes("debian")) return SiDebian;
	if (
		os.includes("centos") ||
		os.includes("rhel") ||
		os.includes("red hat") ||
		os.includes("almalinux") ||
		os.includes("rocky")
	)
		return SiCentos;
	if (os === "ol" || os.includes("oraclelinux") || os.includes("oracle linux"))
		return SiLinux; // Use generic Linux icon for Oracle Linux
	if (os.includes("fedora")) return SiFedora;
	if (os.includes("arch")) return SiArchlinux;
	if (os.includes("alpine")) return SiAlpinelinux;
	if (os.includes("suse") || os.includes("opensuse")) return SiLinux; // SUSE uses generic Linux icon

	// Generic Linux
	if (os.includes("linux")) return SiLinux;

	// Windows
	if (os.includes("windows")) return DiWindows;

	// macOS
	if (os.includes("mac") || os.includes("darwin")) return SiMacos;

	// FreeBSD
	if (os.includes("freebsd")) return Server;

	// Default fallback
	return Monitor;
};

/**
 * OS Color mapping utility
 * Maps operating system types to appropriate colors (react-icons have built-in brand colors)
 */
export const getOSColor = (osType) => {
	if (!osType) return "text-gray-500";

	// react-icons already have the proper brand colors built-in
	// This function is kept for compatibility but returns neutral colors
	return "text-gray-600";
};

/**
 * OS Display name utility
 * Provides clean, formatted OS names for display
 */
export const getOSDisplayName = (osType) => {
	if (!osType) return "Unknown";

	const os = osType.toLowerCase();

	// Linux distributions
	if (os.includes("ubuntu")) return "Ubuntu";
	if (os.includes("debian")) return "Debian";
	if (os.includes("centos")) return "CentOS";
	if (os.includes("almalinux")) return "AlmaLinux";
	if (os.includes("rocky")) return "Rocky Linux";
	if (os === "ol" || os.includes("oraclelinux") || os.includes("oracle linux"))
		return "Oracle Linux";
	if (os.includes("rhel") || os.includes("red hat"))
		return "Red Hat Enterprise Linux";
	if (os.includes("fedora")) return "Fedora";
	if (os.includes("arch")) return "Arch Linux";
	if (os.includes("suse")) return "SUSE Linux";
	if (os.includes("opensuse")) return "openSUSE";
	if (os.includes("alpine")) return "Alpine Linux";

	// Generic Linux
	if (os.includes("linux")) return "Linux";

	// Windows
	if (os.includes("windows")) return "Windows";

	// macOS
	if (os.includes("mac") || os.includes("darwin")) return "macOS";

	// FreeBSD
	if (os.includes("freebsd")) return "FreeBSD";

	// Return original if no match
	return osType;
};

/**
 * OS Icon component with proper styling
 */
export const OSIcon = ({ osType, className = "h-4 w-4", showText = false }) => {
	const IconComponent = getOSIcon(osType);
	const displayName = getOSDisplayName(osType);

	if (showText) {
		return (
			<div className="flex items-center gap-2">
				<IconComponent className={className} title={displayName} />
				<span className="text-sm">{displayName}</span>
			</div>
		);
	}

	return <IconComponent className={className} title={displayName} />;
};
