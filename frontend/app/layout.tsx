import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "../contexts/LanguageContext";
import { AuthProvider } from "../contexts/AuthContext";

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
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-white text-slate-900"
        suppressHydrationWarning
      >
        <AuthProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
