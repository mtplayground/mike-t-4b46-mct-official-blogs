import type { Metadata } from "next";
import "./globals.css";

import { absoluteSiteUrl, defaultDescription, siteName } from "@/lib/metadata";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteSiteUrl()),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  openGraph: {
    title: siteName,
    description: defaultDescription,
    siteName,
    type: "website",
    url: absoluteSiteUrl(),
    images: [
      {
        url: absoluteSiteUrl("/images/editorial-hero.png"),
        width: 1744,
        height: 902,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: defaultDescription,
    images: [absoluteSiteUrl("/images/editorial-hero.png")],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  function mountMctaiWatermark() {
    if (!document.body || document.getElementById('mctai-watermark')) return;
    var root = document.createElement('div');
    root.id = 'mctai-watermark';
    root.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'padding:8px 10px',
      'border-radius:999px',
      'border:1px solid rgba(148,163,184,.35)',
      'background:rgba(15,23,42,.86)',
      'color:#f8fafc',
      'box-shadow:0 10px 30px rgba(15,23,42,.25)',
      'font:500 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'backdrop-filter:blur(10px)'
    ].join(';');
    root.innerHTML =
      '<a href="https://myclawteam.ai" target="_blank" rel="noopener noreferrer" ' +
      'style="color:#f8fafc;text-decoration:none">Built by myClawTeam.ai</a>' +
      '<button type="button" data-mctai-share ' +
      'style="border:0;border-left:1px solid rgba(148,163,184,.35);background:transparent;color:#93c5fd;cursor:pointer;padding:0 0 0 8px;font:inherit">Share</button>';
    document.body.appendChild(root);
    var button = root.querySelector('[data-mctai-share]');
    if (button) {
      button.addEventListener('click', async function () {
        var payload = {
          title: document.title || 'myClawTeam app',
          text: 'Built with myClawTeam.ai',
          url: window.location.href
        };
        try {
          if (navigator.share) {
            await navigator.share(payload);
          } else if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(window.location.href);
            button.textContent = 'Copied';
            setTimeout(function () { button.textContent = 'Share'; }, 1600);
          }
        } catch (_) {
          button.textContent = 'Share';
        }
      });
    }
    var style = document.createElement('style');
    style.textContent =
      '@media (max-width: 640px){#mctai-watermark{right:50%;transform:translateX(50%);bottom:12px;max-width:calc(100vw - 24px)}}';
    document.head.appendChild(style);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountMctaiWatermark, { once: true });
  } else {
    mountMctaiWatermark();
  }
})();
`,
          }}
        />
      </body>
    </html>
  );
}
