"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

export const useSupabase = () => {
	const [isConnected, setIsConnected] = useState(false);

	useEffect(() => {
		if (supabase) {
			setIsConnected(true);
		}
	}, []);

	const getUploads = async (userPublicKey: string) => {
		if (!supabase) {
			throw new Error("Supabase client not initialized");
		}

		const { data, error } = await supabase
			.from("r2_uploads")
			.select("*")
			.eq("creator_wallet_address", userPublicKey);

		if (error) {
			throw error;
		}

		return data;
	};

	const insertUpload = async (uploadData: {
		key: string;
		url: string;
		creator_wallet_address: string;
	}) => {
		if (!supabase) {
			throw new Error("Supabase client not initialized");
		}

		const { data, error } = await supabase
			.from("r2_uploads")
			.insert([
				{
					...uploadData,
					uploaded_at: new Date().toISOString(),
				},
			])
			.select();

		if (error) {
			throw error;
		}

		return data;
	};

	return {
		supabase,
		isConnected,
		getUploads,
		insertUpload,
	};
};
