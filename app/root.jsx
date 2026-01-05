import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "@shopify/polaris/build/esm/styles.css";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        {/* App Bridge must load synchronously before any React code */}
        <script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          crossOrigin="anonymous"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Remove any backend JWT left by other apps on the same origin
                localStorage.removeItem('authToken');
              } catch (e) {
                console.warn('Could not clear authToken', e);
              }

              // Patch fetch to drop HS256 backend JWTs while preserving Shopify RS256 tokens
              const originalFetch = window.fetch;
              window.fetch = async function patchedFetch(input, init = {}) {
                const headers = new Headers(init.headers || {});
                const auth = headers.get('authorization') || headers.get('Authorization');
                if (auth && auth.startsWith('Bearer ')) {
                  const token = auth.slice(7);
                  try {
                    const payload = JSON.parse(atob(token.split('.')[1] || ''));
                    if (payload && payload.iss && typeof payload.iss === 'string' && payload.iss.startsWith('https://')) {
                      // Likely Shopify RS256 session token; keep it
                    } else {
                      // Likely HS256 backend JWT; drop it
                      headers.delete('authorization');
                      headers.delete('Authorization');
                    }
                  } catch (e) {
                    // If token can't be decoded, drop it to be safe
                    headers.delete('authorization');
                    headers.delete('Authorization');
                  }
                }
                return originalFetch(input, { ...init, headers });
              };
            `,
          }}
        />
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
