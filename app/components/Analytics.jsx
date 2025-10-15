import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../services/api';

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
      const response = await analyticsAPI.getAnalytics(period);
      setAnalytics(response.data);
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
      <s-card>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <s-text variant="bodyMd">Loading analytics...</s-text>
        </div>
      </s-card>
    );
  }

  if (error) {
    return (
      <s-banner status="critical">
        <s-text variant="bodyMd">{error}</s-text>
      </s-banner>
    );
  }

  if (!analytics) {
    return (
      <s-card>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <s-text variant="bodyMd">No analytics data available</s-text>
        </div>
      </s-card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Period Selector */}
      <s-card>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <s-text variant="headingMd">Analytics</s-text>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <s-select
              value={period}
              onChange={setPeriod}
              options={[
                { label: 'Last 7 days', value: '7d' },
                { label: 'Last 30 days', value: '30d' },
                { label: 'Last 90 days', value: '90d' },
                { label: 'Last year', value: '1y' }
              ]}
            />
            <s-button variant="secondary" onClick={fetchAnalytics}>
              Refresh
            </s-button>
          </div>
        </div>
      </s-card>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <s-card>
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <s-text variant="bodyMd" tone="subdued">Total Revenue</s-text>
            <s-text variant="heading2xl">
              {formatCurrency(analytics.totalRevenue || 0)}
            </s-text>
          </div>
        </s-card>

        <s-card>
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <s-text variant="bodyMd" tone="subdued">Total Auctions</s-text>
            <s-text variant="heading2xl">
              {analytics.totalAuctions || 0}
            </s-text>
          </div>
        </s-card>

        <s-card>
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <s-text variant="bodyMd" tone="subdued">Average Bid</s-text>
            <s-text variant="heading2xl">
              {formatCurrency(analytics.averageBid || 0)}
            </s-text>
          </div>
        </s-card>

        <s-card>
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <s-text variant="bodyMd" tone="subdued">Active Bidders</s-text>
            <s-text variant="heading2xl">
              {analytics.activeBidders || 0}
            </s-text>
          </div>
        </s-card>
      </div>

      {/* Top Performing Auctions */}
      {analytics.topAuctions && analytics.topAuctions.length > 0 && (
        <s-card>
          <div style={{ padding: '16px' }}>
            <s-text variant="headingMd" style={{ marginBottom: '16px' }}>Top Performing Auctions</s-text>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e1e3e5' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                      <s-text variant="bodyMd">Product</s-text>
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                      <s-text variant="bodyMd">Final Price</s-text>
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                      <s-text variant="bodyMd">Total Bids</s-text>
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                      <s-text variant="bodyMd">Status</s-text>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics && Array.isArray(analytics.topAuctions) && analytics.topAuctions.map((auction, index) => (
                    <tr key={auction.id || index} style={{ borderBottom: '1px solid #f1f2f3' }}>
                      <td style={{ padding: '12px' }}>
                        <s-text variant="bodyMd">
                          {auction.productName || `Product ${auction.shopifyProductId}`}
                        </s-text>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <s-text variant="bodyMd" fontWeight="semibold">
                          {formatCurrency(auction.finalPrice || auction.currentBid || auction.startingBid)}
                        </s-text>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <s-text variant="bodyMd">{auction.totalBids || 0}</s-text>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <s-badge status={auction.status === 'ended' ? 'success' : 'info'}>
                          {auction.status?.toUpperCase() || 'UNKNOWN'}
                        </s-badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </s-card>
      )}

      {/* Revenue Chart Placeholder */}
      <s-card>
        <div style={{ padding: '16px' }}>
          <s-text variant="headingMd" style={{ marginBottom: '16px' }}>Revenue Trend</s-text>
          <div style={{ 
            height: '200px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#f6f6f7',
            borderRadius: '8px'
          }}>
            <s-text variant="bodyMd" tone="subdued">Chart visualization would go here</s-text>
          </div>
        </div>
      </s-card>
    </div>
  );
};

export default Analytics;