import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletContext";

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "CrowdChain - Blockchain Crowdfunding",
    description: "Decentralized crowdfunding platform powered by Ethereum blockchain",
};

export const viewport: Viewport = {
    themeColor: "#0f172a",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} font-sans antialiased`}>
                <WalletProvider>
                    {children}
                </WalletProvider>
            </body>
        </html>
    );
}
