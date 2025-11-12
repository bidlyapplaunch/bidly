import React from 'react';
import { Frame, Page, Layout, Card, Text, Banner, Button, BlockStack } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';

const MarketplaceCustomizationSettings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const search = location.search || '';

  const goToWidgetCustomization = () => {
    navigate(`/customization/widget${search}`);
  };

  return (
    <Frame>
      <Page
        title="Marketplace customization temporarily unavailable"
        subtitle="Widget customization is still available while we upgrade the marketplace experience."
        backAction={{
          content: 'Back',
          onAction: () => navigate(-1)
        }}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="loose">
                <Banner
                  tone="info"
                  title="Marketplace styling is disabled for now"
                >
                  <p>
                    We&apos;re working on significant improvements to marketplace theming. During this update the
                    marketplace style editor is not accessible. Your existing marketplace styling remains unchanged on the
                    storefront.
                  </p>
                </Banner>
                <div>
                  <Text variant="headingMd">Need to adjust visuals?</Text>
                  <Text tone="subdued">
                    You can continue updating the product-page widget appearance without interruption.
                  </Text>
                </div>
                <div>
                  <Button primary onClick={goToWidgetCustomization}>
                    Open widget customization
                  </Button>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
};

export default MarketplaceCustomizationSettings;
