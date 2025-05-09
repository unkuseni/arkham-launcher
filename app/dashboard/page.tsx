import DashboardHeader from "@/components/header/dashboard-header";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const Page = () => {
	return (
		<>
			<SidebarProvider>
				<AppSidebar variant="inset" />
				<SidebarInset>
					<DashboardHeader />
				</SidebarInset>
			</SidebarProvider>
		</>
	);
};
export default Page;
