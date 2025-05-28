import AddLiquidity from "@/components/forms/add-pool";
import BurnTokens from "@/components/forms/burn-token";
import CreatePool from "@/components/forms/create-pool";
import CreateToken from "@/components/forms/create-token";
import DelegateTokens from "@/components/forms/delegate-token";
import FreezeToken from "@/components/forms/freeze-token";
import MintTokens from "@/components/forms/mint-token";
import RemoveLiquidity from "@/components/forms/remove-pool";
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
		case "create-pool":
			content = <CreatePool />;
			break;
		case "add-liquidity":
			content = <AddLiquidity />;
			break;
		case "remove-liquidity":
			content = <RemoveLiquidity />;
			break;
		case "swap-tokens":
			content = <p>Swap tokens</p>;
			break;
		case "view-pool-info":
			content = <p>View pool info</p>;
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
