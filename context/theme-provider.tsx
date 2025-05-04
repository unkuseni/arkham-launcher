import { ThemeProvider } from "next-themes";

/**
 * A wrapper around the `ThemeProvider` component from `next-themes`.
 *
 * The `ThemeProvider` component is used to manage the theme of the application.
 * It provides a default theme and allows the user to switch between different
 * themes.
 *
 * The `attribute` prop is set to `"class"` to add the theme to the `class` attribute
 * of the `html` element.
 *
 * The `defaultTheme` prop is set to `"system"` to use the system theme by default.
 * The `enableSystem` prop is set to `true` to allow the user to switch between
 * different themes.
 */
export function ThemeProviderWrapper({
	children,
}: {
	/**
	 * The children to be rendered within the `ThemeProvider`.
	 */
	children: React.ReactNode;
}) {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			{children}
		</ThemeProvider>
	);
}
