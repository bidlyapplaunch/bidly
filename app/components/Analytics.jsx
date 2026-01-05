import React, { useState, useEffect } from 'react';
import {
  Card,
  Text,
  Select,
  Button,
  Banner,
  Layout,
  BlockStack,
  InlineStack,
  IndexTable
} from '@shopify/polaris';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/analytics?period=${period}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }
      
      const data = await response.json();
      setAnalytics(data.data || data);
    } catch (err) {
      setError('Failed to fetch analytics');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <BlockStack gap="200">
          <Text variant="bodyMd">Loading analytics...</Text>
        </BlockStack>
      </Card>
    );
  }

  if (error) {
    return (
      <Banner status="critical">
        <p>{error}</p>
      </Banner>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <Text variant="bodyMd" tone="subdued">
          No analytics data available
        </Text>
      </Card>
    );
  }

  const topAuctions = analytics.topAuctions || analytics.data?.topAuctions || [];

  const topAuctionsRows = topAuctions.map((auction, index) => (
    <IndexTable.Row id={auction.id || index} key={auction.id || index} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {auction.productName || `Product ${auction.shopifyProductId}`}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold" as="span">
          {formatCurrency(auction.finalPrice || auction.currentBid || auction.startingBid)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">{auction.totalBids || 0}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge status={auction.status === 'ended' ? 'success' : 'info'}>
          {auction.status?.toUpperCase() || 'UNKNOWN'}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <BlockStack gap="400">
      {/* Period Selector */}
      <Card>
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h2">Analytics</Text>
          <InlineStack gap="200">
            <Select
              options={[
                { label: 'Last 7 days', value: '7d' },
                { label: 'Last 30 days', value: '30d' },
                { label: 'Last 90 days', value: '90d' },
                { label: 'Last year', value: '1y' }
              ]}
              value={period}
              onChange={setPeriod}
            />
            <Button onClick={fetchAnalytics}>Refresh</Button>
          </InlineStack>
        </InlineStack>
      </Card>

      {/* Key Metrics */}
      <Layout>
        <Layout.Section oneThird>
          <Card>
            <BlockStack gap="200" align="center">
              <Text variant="bodyMd" tone="subdued">Total Revenue</Text>
              <Text variant="heading2xl">
                {formatCurrency(analytics.revenue?.totalRevenue || analytics.totalRevenue || 0)}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section oneThird>
          <Card>
            <BlockStack gap="200" align="center">
              <Text variant="bodyMd" tone="subdued">Total Auctions</Text>
              <Text variant="heading2xl">
                {analytics.summary?.totalAuctions || analytics.totalAuctions || 0}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section oneThird>
          <Card>
            <BlockStack gap="200" align="center">
              <Text variant="bodyMd" tone="subdued">Average Bid</Text>
              <Text variant="heading2xl">
                {formatCurrency(analytics.revenue?.averageBidAmount || analytics.averageBid || 0)}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Top Performing Auctions */}
      {topAuctions.length > 0 && (
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Top Performing Auctions</Text>
            <IndexTable
              resourceName={{
                singular: 'auction',
                plural: 'auctions',
              }}
              itemCount={topAuctions.length}
              headings={[
                { title: 'Product' },
                { title: 'Final Price' },
                { title: 'Total Bids' },
                { title: 'Status' }
              ]}
              selectable={false}
            >
              {topAuctionsRows}
            </IndexTable>
          </BlockStack>
        </Card>
      )}

      {/* Revenue Chart Placeholder */}
      <Card>
        <BlockStack gap="200">
          <Text variant="headingMd" as="h2">Revenue Trend</Text>
          <div style={{ 
            height: '200px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#f6f6f7',
            borderRadius: '8px'
          }}>
            <Text variant="bodyMd" tone="subdued">Chart visualization would go here</Text>
          </div>
        </BlockStack>
      </Card>
    </BlockStack>
  );
};

export default Analytics;
