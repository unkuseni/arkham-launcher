import CreateToken from "@/components/forms/create-token";
import type { ReactNode } from "react";

export default async function Page({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	let content: ReactNode;

	if (slug === "create-token") {
		content = <CreateToken />;
	}

	return (
		<>
			<div className="p-6">{content}</div>
		</>
	);
}
