import KeypairCreator from "@/components/forms/wallets/create";
import type { ReactNode } from "react";


export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let content: ReactNode;

  switch (slug) {
    case "create-wallet":
      content = <KeypairCreator />;
      break;
    default:
      content = <div>Not Found</div>
  }

  return (
    <>
      <div className="p-6">{content}</div>
    </>
  )
}