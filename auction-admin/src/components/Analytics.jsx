import React, { useEffect, useMemo, useState } from 'react';
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
import useAdminI18n from '../hooks/useAdminI18n';

const Analytics = () => {
  const i18n = useAdminI18n();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');
  const periodOptions = useMemo(
    () => [
      { label: i18n.translate('admin.analytics.period.last7'), value: '7d' },
      { label: i18n.translate('admin.analytics.period.last30'), value: '30d' },
      { label: i18n.translate('admin.analytics.period.last90'), value: '90d' },
      { label: i18n.translate('admin.analytics.period.lastYear'), value: '1y' }
    ],
    [i18n]
  );

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
      setError(i18n.translate('admin.analytics.error'));
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

  const formatCurrency = (amount, currency = analytics?.revenue?.currency || 'USD') => {
    return new Intl.NumberFormat(i18n.locale || 'en', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(i18n.locale || 'en');
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { status: 'warning', children: i18n.translate('admin.analytics.status.pending') },
      active: { status: 'success', children: i18n.translate('admin.analytics.status.active') },
      ended: { status: 'info', children: i18n.translate('admin.analytics.status.ended') },
      closed: { status: 'critical', children: i18n.translate('admin.analytics.status.closed') }
    };
    return <Badge {...statusMap[status]} />;
  };

  if (loading) {
    return (
      <Card sectioned>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner accessibilityLabel={i18n.translate('admin.analytics.loadingLabel')} size="large" />
          <Text variant="bodyMd" as="p" color="subdued">
            {i18n.translate('admin.analytics.loadingText')}
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
          <Text variant="bodyMd">{i18n.translate('admin.analytics.empty')}</Text>
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
    auction.productData?.title || auction.shopifyProductId || i18n.translate('admin.analytics.unknownProduct'),
    formatCurrency(auction.currentBid),
    auction.bidHistory?.length || 0,
    formatDate(auction.createdAt)
  ]);

  // Prepare recent activity data
  const recentActivityRows = recentActivity.map(activity => [
    activity.productData?.title || activity.shopifyProductId || i18n.translate('admin.analytics.unknownProduct'),
    formatCurrency(activity.currentBid),
    getStatusBadge(activity.status),
    formatDate(activity.createdAt)
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header with period selector */}
      <Card sectioned>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="headingLg" as="h2">{i18n.translate('admin.analytics.headerTitle')}</Text>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Select
              label={i18n.translate('admin.analytics.period.label')}
              options={periodOptions}
              value={period}
              onChange={setPeriod}
            />
            <Button
              icon={RefreshMinor}
              onClick={fetchAnalytics}
              disabled={loading}
            >
              {i18n.translate('admin.common.refresh')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <Layout>
        <Layout.Section oneHalf>
          <Card sectioned>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Text variant="headingMd">{i18n.translate('admin.analytics.summary.title')}</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.summary.total')}</Text>
                  <Text variant="headingLg">{summary.totalAuctions}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.summary.active')}</Text>
                  <Text variant="headingLg" color="success">{summary.activeAuctions}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.summary.ended')}</Text>
                  <Text variant="headingLg">{summary.endedAuctions}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.summary.pending')}</Text>
                  <Text variant="headingLg" color="warning">{summary.pendingAuctions}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.summary.closed')}</Text>
                  <Text variant="headingLg" color="critical">{summary.closedAuctions}</Text>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section oneHalf>
          <Card sectioned>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Text variant="headingMd">{i18n.translate('admin.analytics.revenue.title')}</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.revenue.total')}</Text>
                  <Text variant="headingLg" color="success">{formatCurrency(revenue.totalRevenue)}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.revenue.averageBid')}</Text>
                  <Text variant="headingLg">{formatCurrency(revenue.averageBidAmount)}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.revenue.currency')}</Text>
                  <Text variant="headingLg">{revenue.currency}</Text>
                </div>
                <div>
                  <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.revenue.successRate')}</Text>
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
          <Text variant="headingMd">{i18n.translate('admin.analytics.bidding.title')}</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.bidding.total')}</Text>
              <Text variant="headingLg">{bidding.totalBids}</Text>
            </div>
            <div>
              <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.bidding.averagePerAuction')}</Text>
              <Text variant="headingLg">{bidding.averageBidsPerAuction.toFixed(1)}</Text>
            </div>
            <div>
              <Text variant="bodyMd" color="subdued">{i18n.translate('admin.analytics.bidding.successRate')}</Text>
              <Text variant="headingLg" color="success">{bidding.successRate}%</Text>
            </div>
          </div>
        </div>
      </Card>

      {/* Daily Statistics Chart */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Text variant="headingMd">{i18n.translate('admin.analytics.daily.title')}</Text>
          <DataTable
            columnContentTypes={['text', 'numeric', 'text', 'numeric']}
            headings={[
              i18n.translate('admin.analytics.daily.columns.date'),
              i18n.translate('admin.analytics.daily.columns.auctions'),
              i18n.translate('admin.analytics.daily.columns.revenue'),
              i18n.translate('admin.analytics.daily.columns.bids')
            ]}
            rows={dailyStatsRows}
          />
        </div>
      </Card>

      {/* Top Performing Auctions */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Text variant="headingMd">{i18n.translate('admin.analytics.top.title')}</Text>
          <DataTable
            columnContentTypes={['text', 'text', 'numeric', 'text']}
            headings={[
              i18n.translate('admin.analytics.top.columns.product'),
              i18n.translate('admin.analytics.top.columns.currentBid'),
              i18n.translate('admin.analytics.top.columns.totalBids'),
              i18n.translate('admin.analytics.top.columns.created')
            ]}
            rows={topAuctionsRows}
          />
        </div>
      </Card>

      {/* Recent Activity */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Text variant="headingMd">{i18n.translate('admin.analytics.activity.title')}</Text>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text']}
            headings={[
              i18n.translate('admin.analytics.activity.columns.product'),
              i18n.translate('admin.analytics.activity.columns.currentBid'),
              i18n.translate('admin.analytics.activity.columns.status'),
              i18n.translate('admin.analytics.activity.columns.created')
            ]}
            rows={recentActivityRows}
          />
        </div>
      </Card>
    </div>
  );
};

export default Analytics;
