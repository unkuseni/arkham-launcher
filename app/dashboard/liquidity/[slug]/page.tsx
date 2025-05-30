import AddLiquidity from "@/components/forms/pools/add-pool";
import CreatePool from "@/components/forms/pools/create-pool";
import LockLiquidityPage from "@/components/forms/pools/lock-liquidity";
import PoolInfo from "@/components/forms/pools/pool-info";
import RemoveLiquidity from "@/components/forms/pools/remove-pool";
import SwapToken from "@/components/forms/pools/swap-token";
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
    case "lock":
      content = <LockLiquidityPage />;
      break;
    case "view-pool-info":
      content = <PoolInfo />;
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