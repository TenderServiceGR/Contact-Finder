import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company Intelligence & Contact Discovery",
  description: "Search a Greek company once, get its registry identity, contacts, web presence, and procurement history in a single profile.",
  icons: {
    icon: "https://www.tender-service.com/favicon-32x32.webp",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
