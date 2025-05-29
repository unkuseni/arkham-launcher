import AddLiquidity from "@/components/forms/add-pool";
import CreatePool from "@/components/forms/create-pool";
import RemoveLiquidity from "@/components/forms/remove-pool";
import SwapToken from "@/components/forms/swap-token";
import type { ReactNode } from "react";




export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let content: ReactNode;
  switch (slug) {
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
      content = <SwapToken />;
      break;
    case "view-pool-info":
      content = <p>View pool info</p>;
      break;
    default:
      content = <div>Not Found</div>;
  }

  return (
    <>
      <div className="p-6">{content}</div>
    </>
  );
}