import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: "Aragon.ai — Image Validation Pipeline",
  description: "Upload and validate images through the Aragon AI processing pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Default to dark until client-side JS kicks in (avoids FOUC on dark pref)
    <html lang="en" className="bp5-dark" data-theme="dark">
      <body className="bp5-dark">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
