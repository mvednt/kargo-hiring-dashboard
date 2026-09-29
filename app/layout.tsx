import "./globals.css";
import Nav from "./nav";
import ThemeToggle from "./theme";

export const metadata = {
  title: "Kargo Hiring",
  description: "Internal hiring review tool",
};

/**
 * Runs before first paint, so a pinned dark theme never flashes white on the
 * way in. It has to be inline and synchronous — a React effect runs after the
 * browser has already painted the light default.
 */
const NO_FLASH = `try{var t=localStorage.getItem('kargo-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="logo">
              <span className="mark">K</span>
              <span>
                <span className="name">Kargo</span>
                <br />
                <span className="sub">Hiring</span>
              </span>
            </div>
            <Nav />
            <div className="sidefoot">
              <div className="sidenote">
                <b>The system recommends.</b>
                <br />
                You decide. Nothing is sent without a confirmation on the card.
              </div>
              <ThemeToggle />
            </div>
          </aside>
          <main className="main">
            <div className="inner">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
