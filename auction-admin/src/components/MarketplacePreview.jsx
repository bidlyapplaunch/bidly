import React, { useMemo } from 'react';
import { AppProvider, Page, Layout, Text } from '@shopify/polaris';
import { buildMarketplaceCSS, normalizeMarketplaceTheme } from '@shared/marketplaceTheme.js';
import AuctionCard from '@customer/components/AuctionCard.jsx';
import useAdminI18n from '../hooks/useAdminI18n';

const MOCK_AUCTIONS = [
  {
    _id: 'preview-auction-1',
    shopifyProductId: 'SKU-001',
    productData: {
      title: 'Modern Canvas Backpack',
      vendor: 'Northwind Supply',
      price: 185,
      description: 'Durable canvas backpack with premium leather straps.',
      image: {
        src: 'https://cdn.shopify.com/s/files/1/0433/3385/2185/files/bag_1024x1024.jpg?v=1613166682'
      }
    },
    status: 'active',
    startingBid: 95,
    currentBid: 142,
    bidHistory: [
      { bidder: 'Jordan A.', amount: 142 },
      { bidder: 'River L.', amount: 131 }
    ],
    buyNowPrice: 220,
    startTime: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString()
  },
  {
    _id: 'preview-auction-2',
    shopifyProductId: 'SKU-002',
    productData: {
      title: 'Nordic Ceramic Planter Set',
      vendor: 'True Nordic',
      price: 120,
      description: 'Matte ceramic planters with walnut stands.',
      image: {
        src: 'https://cdn.shopify.com/s/files/1/0433/3385/2185/files/planter_1024x1024.jpg?v=1613166682'
      }
    },
    status: 'pending',
    startingBid: 40,
    currentBid: 40,
    bidHistory: [],
    buyNowPrice: 150,
    startTime: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString()
  }
];

const MarketplacePreview = ({ customization, shopName }) => {
  const i18n = useAdminI18n();
  const theme = useMemo(() => normalizeMarketplaceTheme(customization), [customization]);
  const css = useMemo(() => buildMarketplaceCSS(theme), [theme]);
  const hasGradient = theme.gradientEnabled ? '1' : '0';
  const resolvedShopName = shopName || i18n.translate('admin.marketplace.preview.shopNameFallback');

  return (
    <div
      className="bidly-preview-shell"
      style={{
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
        borderRadius: 32,
        overflow: 'hidden',
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)'
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className="bidly-marketplace-root"
        data-bidly-marketplace-template={theme.template}
        data-bidly-marketplace-gradient={hasGradient}
      >
        <AppProvider>
            <Page
              title={i18n.translate('admin.marketplace.preview.pageTitle')}
              subtitle={i18n.translate('admin.marketplace.preview.pageSubtitle')}
              secondaryActions={[
                {
                  content: i18n.translate('admin.marketplace.preview.demoAction'),
                  onAction: () => {}
                }
              ]}
            >
              <Layout>
                {MOCK_AUCTIONS.map((auction) => (
                  <Layout.Section key={auction._id} oneHalf>
                    <AuctionCard
                      auction={auction}
                      onBidPlaced={() => {}}
                      onBuyNow={() => {}}
                      isLoading={false}
                    />
                  </Layout.Section>
                ))}
              </Layout>
            </Page>
        </AppProvider>
      </div>
    </div>
  );
};

export default MarketplacePreview;

