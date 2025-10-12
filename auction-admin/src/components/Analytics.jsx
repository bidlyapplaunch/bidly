import React, { useState, useEffect } from 'react';
import {
  Card,
  Text,
  Layout,
  Select,
  Spinner,
  Banner,
  DataTable,
  Badge,
  Button
} from '@shopify/polaris';
import { RefreshMinor } from '@shopify/polaris-icons';
import { analyticsAPI } from '../services/api';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [periodOptions] = useState([
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
    { label: 'Last year', value: '1y' }
  ]);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Debug authentication
      const token = localStorage.getItem('authToken');
      console.log('🔍 Analytics Debug:');
      console.log('  - Token exists:', !!token);
      console.log('  - Token preview:', token ? token.substring(0, 20) + '...' : 'None');
      console.log('  - Period:', period);
      
      const response = await analyticsAPI.getAnalytics(period);
      console.log('✅ Analytics response:', response);
      setAnalytics(response.data);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('❌ Error fetching analytics:', err);
      console.error('❌ Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { status: 'warning', children: 'Pending' },
      active: { status: 'success', children: 'Active' },
      ended: { status: 'info', children: 'Ended' },
      closed: { status: 'critical', children: 'Closed' }
    };
    return <Badge {...statusMap[status]} />;
  };

  if (loading) {
    return (
      <Card sectioned>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner accessibilityLabel="Loading analytics" size="large" />
          <Text variant="bodyMd" as="p" color="subdued">
            Loading analytics data...
          </Text>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sectioned>
        <Banner status="critical">
          <Text variant="bodyMd">{error}</Text>
        </Banner>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card sectioned>
        <Banner>
          <Text variant="bodyMd">No analytics data available</Text>
        </Banner>
      </Card>
    );
  }

  const { summary, revenue, bidding, topAuctions, recentActivity, dailyStats } = analytics;

  // Prepare daily stats for the chart
  const recentDailyStats = dailyStats.slice(-7); // Last 7 days
  const dailyStatsRows = recentDailyStats.map(day => [
    formatDate(day.date),
    day.auctions.toString(),
    formatCurrency(day.revenue),
    day.bids.toString()
  ]);

  // Prepare top auctions data
  const topAuctionsRows = topAuctions.map(auction => [
    auction.productData?.title || auction.shopifyProductId || 'Unknown Product',
    formatCurrency(auction.currentBid),
    auction.bidHistory?.length || 0,
    formatDate(auction.createdAt)
  ]);

  // Prepare recent activity data
  const recentActivityRows = recentActivity.map(activity => [
    activity.productData?.title || activity.shopifyProductId || 'Unknown Product',
    formatCurrency(activity.currentBid),
    getStatusBadge(activity.status),
    formatDate(activity.createdAt)
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header with period selector */}
      <Card sectioned>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="headingLg" as="h2">📊 Enhanced Analytics</Text>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Select
              label="Time Period"
              options={periodOptions}
              value={period}
              onChange={setPeriod}
            />
            <Button
              icon={RefreshMinor}
              onClick={fetchAnalytics}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <Layout>
        <Layout.Section oneHalf>
          <Card sectioned>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Text variant="headingMd">📈 Auction Summary</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <Text variant="bodyMd" color="subdued">Total Auctions</Text>
                  <Text variant="headingLg">{summary.totalAuctions}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">Active Auctions</Text>
                  <Text variant="headingLg" color="success">{summary.activeAuctions}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">Ended Auctions</Text>
                  <Text variant="headingLg">{summary.endedAuctions}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">Pending Auctions</Text>
                  <Text variant="headingLg" color="warning">{summary.pendingAuctions}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">Closed Auctions</Text>
                  <Text variant="headingLg" color="critical">{summary.closedAuctions}</Text>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section oneHalf>
          <Card sectioned>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Text variant="headingMd">💰 Revenue Metrics</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <Text variant="bodyMd" color="subdued">Total Revenue</Text>
                  <Text variant="headingLg" color="success">{formatCurrency(revenue.totalRevenue)}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">Avg Bid Amount</Text>
                  <Text variant="headingLg">{formatCurrency(revenue.averageBidAmount)}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">Currency</Text>
                  <Text variant="headingLg">{revenue.currency}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">Bid Success Rate</Text>
                  <Text variant="headingLg">{bidding.successRate}%</Text>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Bidding Statistics */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Text variant="headingMd">🎯 Bidding Statistics</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <Text variant="bodyMd" color="subdued">Total Bids</Text>
              <Text variant="headingLg">{bidding.totalBids}</Text>
            </div>
            <div>
              <Text variant="bodyMd" color="subdued">Avg Bids per Auction</Text>
              <Text variant="headingLg">{bidding.averageBidsPerAuction.toFixed(1)}</Text>
            </div>
            <div>
              <Text variant="bodyMd" color="subdued">Success Rate</Text>
              <Text variant="headingLg" color="success">{bidding.successRate}%</Text>
            </div>
          </div>
        </div>
      </Card>

      {/* Daily Statistics Chart */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Text variant="headingMd">📅 Daily Statistics (Last 7 Days)</Text>
          <DataTable
            columnContentTypes={['text', 'numeric', 'text', 'numeric']}
            headings={['Date', 'Auctions', 'Revenue', 'Bids']}
            rows={dailyStatsRows}
          />
        </div>
      </Card>

      {/* Top Performing Auctions */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Text variant="headingMd">🏆 Top Performing Auctions</Text>
          <DataTable
            columnContentTypes={['text', 'text', 'numeric', 'text']}
            headings={['Product', 'Current Bid', 'Total Bids', 'Created']}
            rows={topAuctionsRows}
          />
        </div>
      </Card>

      {/* Recent Activity */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Text variant="headingMd">⚡ Recent Activity</Text>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text']}
            headings={['Product', 'Current Bid', 'Status', 'Created']}
            rows={recentActivityRows}
          />
        </div>
      </Card>
    </div>
  );
};

export default Analytics;
