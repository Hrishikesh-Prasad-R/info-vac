import type { Metadata } from "next";
import { Inter, Roboto, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InfoVac",
  description:
    "Autonomous loyalty program competitive intelligence. Discover sources, extract 44 fields, verify every claim.",
  keywords: "loyalty program, competitive intelligence, analyst, InfoVac",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${roboto.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: "var(--kobie-font-body)" }}
      >
        {children}
      </body>
    </html>
  );
}
