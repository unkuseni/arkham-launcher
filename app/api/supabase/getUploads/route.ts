import { supabase } from "@/lib/supabaseClient";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	if (!supabase) {
		return NextResponse.json(
			{ error: "Supabase client is not initialized." },
			{ status: 500 },
		);
	}

	const { searchParams } = new URL(req.url);
	const userPublicKey = searchParams.get("userPublicKey");

	if (!userPublicKey) {
		return NextResponse.json(
			{ error: "userPublicKey query parameter is required." },
			{ status: 400 },
		);
	}

	if (userPublicKey.trim().length === 0) {
		return NextResponse.json(
			{ error: "userPublicKey cannot be empty." },
			{ status: 400 },
		);
	}

	try {
		const { data, error } = await supabase
			.from("keypairs")
			.select("*")
			.eq("creator_wallet_address", userPublicKey)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("Error fetching keypairs from Supabase:", error);
			return NextResponse.json(
				{
					error: "Failed to fetch keypairs from Supabase.",
					details: error.message,
				},
				{ status: 500 },
			);
		}

		return NextResponse.json({
			keypairs: data || [],
			count: data?.length || 0,
			userPublicKey,
		});
	} catch (err) {
		console.error("Error in getKeypairs API:", err);
		return NextResponse.json(
			{
				error: "An unexpected error occurred.",
				details: err instanceof Error ? err.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
