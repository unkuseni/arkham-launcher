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
	} else if (slug === "mint-token") {
		content = <div>Mint Token</div>;
	} else if (slug === "transfer-token") {
		content = <div>Transfer Token</div>;
	} else if (slug === "delegate-token") {
		content = <div>Delegate Token</div>;
	} else if (slug === "update-token") {
		content = <div>Update Token</div>;
	} else if (slug === "burn-token") {
		content = <div>Burn Token</div>;
	} else if (slug === "freeze-token") {
		content = <div>Freeze Token</div>;
	}
	return (
		<>
			<div className="p-6">{content}</div>
		</>
	);
}
