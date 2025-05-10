import CreateToken from "@/components/forms/create-token";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function Page({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	return (
		<>
			<div className="p-6">
				<CreateToken />
			</div>
		</>
	);
}
