import DashboardHeader from "@/components/header/dashboard-header";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
export default function DashboardLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<>
			<SidebarProvider>
				<AppSidebar variant="inset" />
				<SidebarInset>
					<DashboardHeader />
					{children}
				</SidebarInset>
			</SidebarProvider>
		</>
	);
}
