"use client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { type PolicyAgreement, signPolicy } from "@/lib/policy";
import useUmiStore from "@/store/useUmiStore";
import { set } from "@metaplex-foundation/umi/serializers";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChartAreaIcon, Link as LinkIcon, Shield, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import CountUp from "react-countup";

export default function Home() {
	return (
		<>
			<Header />
			<main
				className={
					"min-h-[calc(100vh-96px)] flex flex-col items-center justify-center transition-colors duration-300 px-4 py-2.5 md:px-6 md:py-4 xl:px-8 xl:py-6 "
				}
			>
				<Hero />
			</main>
		</>
	);
}

const Hero = () => {
	const [checked, setChecked] = useState(false);
	const signer = useUmiStore((state) => state.signer?.publicKey) as string;

	const handleSign = useCallback(async () => {
		if (!signer) {
			alert("Please connect your wallet first.");
			return;
		}

		const policy: PolicyAgreement = {
			user: signer,
			policyId: "Policy-v1",
			timestamp: Date.now(),
			terms:
				"I agree to the Arkham Launchpad Terms of service & Privacy Policy.",
		};

		const [signature, timestamp] = await signPolicy(policy);
		console.log("Signature:", signature);
		console.log("Timestamp:", timestamp);
		console.log("Policy signed successfully!");
	}, [signer]);

	return (
		<div className="w-full max-w-7xl mx-auto flex flex-col items-center justify-center space-y-8 py-12 px-4 bg-[url('/hero-bg.jpg')] bg-cover bg-center bg-no-repeat rounded-3xl text-white">
			<h1 className="text-center leading-relaxed text-2xl md:text-3xl lg:text-4xl font-bold font-inter bg-clip-text text-transparent bg-gradient-to-r from-gray-50 to-gray-600">
				Launch and manage your tokens <br />
				in <span className="animate-pulse capitalize">seconds</span>
			</h1>
			<div className="flex items-center gap-2 w-full p-4">
				<ul className="list-none flex flex-col w-full max-w-xl mx-auto font-bold font-sans tracking-wider">
					<li className="h-16 md:self-start flex gap-3">
						<Star />
						<span>No-Code Token Wizard</span>
					</li>
					<li className="h-16 md:self-end flex gap-3">
						<LinkIcon />
						<span>Multichain Deployment</span>
					</li>
					<li className="h-16 md:self-start flex gap-3">
						<Shield />
						<span>Secure and Audited Contracts</span>
					</li>
					<li className="h-16 md:self-end flex gap-3">
						<ChartAreaIcon />
						<span>Live Dashboard and Analytics</span>
					</li>
				</ul>
			</div>
			<div className="flex flex-col items-center justify-center gap-4 w-full max-w-xl mx-auto">
				<div className="flex items-center gap-2 font-sans">
					<Checkbox
						id="terms"
						checked={checked}
						onClick={() => setChecked(!checked)}
					/>
					<Label htmlFor="terms">
						I agree to the{" "}
						<Link href="#" className="text-blue-500 hover:text-blue-400">
							Terms of Service
						</Link>{" "}
						and{" "}
						<Link href="#" className="text-blue-500 hover:text-blue-400">
							Privacy Policy
						</Link>
					</Label>
				</div>
				<Button onClick={handleSign} disabled={!checked}>
					Launch Your x1000 Token
				</Button>
			</div>
		</div>
	);
};
