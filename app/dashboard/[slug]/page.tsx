import { SidebarTrigger } from "@/components/ui/sidebar";

export default async function Page({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	return (
		<>
			<div>
				<SidebarTrigger />
			</div>
			<div>My Post: {slug}</div>
		</>
	);
}
