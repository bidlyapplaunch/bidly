import { Outlet, useRouteError } from "@remix-run/react";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";

export default function App() {
  return (
    <AppBridgeProvider>
      <PolarisProvider i18n={{}}>
        <Outlet />
      </PolarisProvider>
    </AppBridgeProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
