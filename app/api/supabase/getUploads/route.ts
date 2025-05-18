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

	try {
		const { data, error } = await supabase
			.from("r2_uploads")
			.select("*")
			.eq("creator_wallet_address", userPublicKey);

		if (error) {
			console.error("Error fetching data from Supabase:", error);
			return NextResponse.json(
				{ error: "Failed to fetch data from Supabase." },
				{ status: 500 },
			);
		}

		return NextResponse.json({ uploads: data });
	} catch (err) {
		console.error("Error in getUploads API:", err);
		return NextResponse.json(
			{ error: "An unexpected error occurred." },
			{ status: 500 },
		);
	}
}
