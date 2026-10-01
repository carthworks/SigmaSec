import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigmasec.ai";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SigmaSec — AI Security Posture Intelligence Platform",
    template: "%s | SigmaSec",
  },
  description:
    "Five open-source scanners in one queue, prioritised with CISA KEV and EPSS, with plain-English explanations and dependency-upgrade pull requests. Self-hostable, with a local AI option.",
  keywords: [
    "Application Security",
    "ASPM",
    "CISA KEV",
    "EPSS",
    "Vulnerability Management",
    "Opengrep",
    "Trivy",
    "Nuclei",
    "Gitleaks",
    "Automated Remediation",
  ],
  authors: [{ name: "SigmaSec Security Team" }],
  creator: "SigmaSec",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/apple-icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "SigmaSec — From Security Noise to Actionable Intelligence",
    description:
      "One prioritised queue from Nuclei, Trivy, Gitleaks, Opengrep and Nmap, ranked with CISA KEV and EPSS, with fix PRs for dependency upgrades.",
    siteName: "SigmaSec",
    images: [
      {
        url: "/Unified_Security_Intelligence_Workflow.png",
        width: 1200,
        height: 630,
        alt: "SigmaSec Security Intelligence Pipeline",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SigmaSec — From Security Noise to Actionable Intelligence",
    description:
      "One prioritised queue from five open-source scanners, ranked with CISA KEV and EPSS, with fix PRs for dependency upgrades.",
    images: ["/Unified_Security_Intelligence_Workflow.png"],
    creator: "@sigmasec",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >

          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" closeButton />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
