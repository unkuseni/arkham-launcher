import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const Page = () => {
	return (
		<>
			<SidebarProvider className="w-[18rem]">
				<AppSidebar variant="floating" />
				<SidebarInset>
					<div>
						<h2>dashboard</h2>
					</div>
				</SidebarInset>
			</SidebarProvider>
		</>
	);
};
export default Page;
