import BurnTokens from "@/components/forms/burn-token";
import CreateToken from "@/components/forms/create-token";
import DelegateTokens from "@/components/forms/delegate-token";
import FreezeToken from "@/components/forms/freeze-token";
import MintTokens from "@/components/forms/mint-token";
import TransferTokens from "@/components/forms/transfer-token";
import UpdateToken from "@/components/forms/update-token";
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
		content = <MintTokens />;
	} else if (slug === "transfer-token") {
		content = <TransferTokens />;
	} else if (slug === "delegate-token") {
		content = <DelegateTokens />;
	} else if (slug === "update-token") {
		content = <UpdateToken />;
	} else if (slug === "burn-token") {
		content = <BurnTokens />;
	} else if (slug === "freeze-token") {
		content = <FreezeToken />;
	}
	return (
		<>
			<div className="p-6">{content}</div>
		</>
	);
}
