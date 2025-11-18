import type { Metadata } from "next";
import { Roboto, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const body = Roboto({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
});
const heading = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Pocket Atlas - AI Travel Planner",
  description: "Your AI-powered travel companion. Plan perfect trips with intelligent recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${body.variable} ${heading.variable} font-sans antialiased bg-white text-slate-900`}
      >
        {children}
      </body>
    </html>
  );
}
