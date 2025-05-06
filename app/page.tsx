"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import ModeToggle from "@/components/ui/mode-toggle";
import { useEffect, useState } from "react";
import CountUp from "react-countup";

export default function Home() {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

 
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; 
  }

  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = currentTheme === "dark";

  return (
    <main
      className={`min-h-screen px-4 py-12 flex flex-col items-center justify-center transition-colors duration-300 ${
        isDark ? "bg-black text-white" : "bg-white text-black"
      }`}
    >
      <div className="fixed top-4 right-4">
        <ModeToggle />
      </div>

      <section className="max-w-6xl w-full flex flex-col-reverse md:flex-row items-center justify-between gap-10 mt-6">
        {/* Left content */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Tokens & NFT with Ease
          </h1>
          <p
            className={`text-lg mb-6 ${
              isDark ? "text-gray-300" : "text-gray-600"
            }`}
          >
            Launch Token, Liquidity, Airdrops and much more. Effortless and
            without coding.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <button className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition">
              Create Launch
            </button>
            <button className="border border-blue-600 text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900 transition">
              Create Token
            </button>
          </div>
        </div>

        {/* Right image */}
        <div className="flex-1 flex justify-center">
          <Image
            src="/bg.webp"
            alt="BGlogo"
            width={320}
            height={320}
            className="w-64 md:w-80 h-auto"
            priority
          />
        </div>
      </section>

      {/* Stats */}
      <section className="mt-16 text-center w-full max-w-6xl px-4">
        <h2
          className={`text-lg mb-6 ${
            isDark ? "text-gray-400" : "text-gray-800"
          }`}
        >
          OUR NUMBERS
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-b border-gray-700 py-6">
          {[
            [2500, "PROJECTS"],
            [7000, "USERS"],
            [65000000, "VOLUME"],
            [120000, "TRANSACTIONS"],
          ].map(([value, label], index) => {
            const isLastColumnMd = index % 4 === 3;
            const isLastColumnSm = index % 2 === 0;

            return (
              <div
                key={label}
                className={`relative flex flex-col items-center justify-center px-4
            border-gray-500
            ${index % 2 === 0 ? "border-r" : ""}
            md:${index % 4 === 3 ? "border-r-0" : "border-r"}
          `}
              >
                <p className="text-3xl font-extrabold dark:text-white">
                  +
                  <CountUp
                    end={Number(value)}
                    duration={2}
                    separator=","
                    enableScrollSpy
                    scrollSpyOnce
                    formattingFn={(num) => {
                      if (num >= 1_000_000) {
                        return (num / 1_000_000)
                          .toFixed(1)
                          .replace(/\.0$/, "") + "M";
                      } else if (num >= 1_000) {
                        return (num / 1_000)
                          .toFixed(1)
                          .replace(/\.0$/, "") + "k";
                      }
                      return num.toString();
                    }}
                  />
                </p>
                <p className="text-sm tracking-widest mt-1 dark:text-white">
                  {label}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
