
import BurnTokens from "@/components/forms/token/burn-token";
import CreateToken from "@/components/forms/token/create-token";
import DelegateTokens from "@/components/forms/token/delegate-token";
import FreezeToken from "@/components/forms/token/freeze-token";
import MintTokens from "@/components/forms/token/mint-token";
import TransferTokens from "@/components/forms/token/transfer-token";
import UpdateToken from "@/components/forms/token/update-token";
import type { ReactNode } from "react";

export default async function Page({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	let content: ReactNode;
	switch (slug) {
		case "create-token":
			content = <CreateToken />;
			break;
		case "mint-token":
			content = <MintTokens />;
			break;
		case "transfer-token":
			content = <TransferTokens />;
			break;
		case "delegate-token":
			content = <DelegateTokens />;
			break;
		case "update-token":
			content = <UpdateToken />;
			break;
		case "burn-token":
			content = <BurnTokens />;
			break;
		case "freeze-token":
			content = <FreezeToken />;
			break;
		default:
			content = <p>Invalid slug</p>;
	}
	return (
		<>
			<div className="p-6">{content}</div>
		</>
	);
}
