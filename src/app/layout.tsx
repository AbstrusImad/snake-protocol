import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Snake Protocol — Weekly PVP on GenLayer",
  description: "Real-time 1v1 Snake game with on-chain XP. Win matches, earn XP validated by GenLayer AI validators, and climb the global leaderboard.",
  openGraph: {
    title: "Snake Protocol — Weekly PVP on GenLayer",
    description: "Real-time 1v1 Snake game with on-chain XP. Win matches, earn XP validated by GenLayer AI validators, and climb the global leaderboard.",
    url: "https://snake-protocol.vercel.app",
    siteName: "Snake Protocol",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Snake Protocol — Weekly PVP on GenLayer",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Snake Protocol — Weekly PVP on GenLayer",
    description: "Real-time 1v1 Snake game with on-chain XP validated by GenLayer AI validators.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-white min-h-screen antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
