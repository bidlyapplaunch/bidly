import { Outlet, useRouteError } from "react-router";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";

export default function App() {
  return (
    <ShopifyAppProvider embedded>
      <PolarisProvider i18n={{}}>
        <Outlet />
      </PolarisProvider>
    </ShopifyAppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
