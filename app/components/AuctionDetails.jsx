import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { auctionAPI } from '../services/api';

const AuctionDetails = ({ isOpen, onClose, auction, onRefresh }) => {
  const [auctionData, setAuctionData] = useState(auction);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (auction && isOpen) {
      fetchAuctionDetails();
    }
  }, [auction, isOpen]);

  const fetchAuctionDetails = async () => {
    const auctionId = auction?.id || auction?._id;
    if (!auctionId) {
      console.log('❌ No auction ID found:', auction);
      return;
    }
    
    try {
      setLoading(true);
      console.log('🔍 Fetching auction details for ID:', auctionId);
      const response = await auctionAPI.getAuctionById(auctionId);
      console.log('✅ Auction details fetched:', response.data);
      setAuctionData(response.data);
    } catch (error) {
      console.error('❌ Error fetching auction details:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAuction = async () => {
    try {
      const auctionId = auctionData?.id || auctionData?._id;
      await auctionAPI.closeAuction(auctionId);
      setToastMessage('Auction closed successfully');
      setShowToast(true);
      fetchAuctionDetails();
      onRefresh?.();
    } catch (error) {
      console.error('Error closing auction:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date) => {
    return format(new Date(date), 'MMM dd, yyyy HH:mm:ss');
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { status: 'success', children: 'Active' },
      closed: { status: 'critical', children: 'Closed' }
    };
    return <s-badge status={statusMap[status]?.status || 'info'}>{statusMap[status]?.children || status}</s-badge>;
  };

  const getTimeStatus = () => {
    if (!auctionData) return null;
    
    const now = new Date();
    const start = new Date(auctionData.startTime);
    const end = new Date(auctionData.endTime);
    
    if (now < start) {
      return <s-badge status="info">Not Started</s-badge>;
    } else if (now > end) {
      return <s-badge status="critical">Ended</s-badge>;
    } else {
      return <s-badge status="success">Live</s-badge>;
    }
  };

  const getBidHistoryRows = () => {
    if (!auctionData?.bidHistory?.length) {
      return [];
    }

    return auctionData.bidHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map((bid, index) => [
        index + 1,
        bid.bidder,
        formatCurrency(bid.amount),
        formatDate(bid.timestamp)
      ]);
  };

  if (!auctionData) {
    return null;
  }

  const bidHistoryRows = getBidHistoryRows();

  if (!isOpen) return null;

  return (
    <>
      <s-modal
        open={isOpen}
        onClose={onClose}
        title="Auction Details"
        size="large"
      >
        <s-modal-content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Auction Overview */}
            <s-card>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <s-text variant="headingMd">Auction Overview</s-text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">Product ID</s-text>
                    <s-text variant="bodyLg">{auctionData.shopifyProductId}</s-text>
                  </div>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">Status</s-text>
                    <div>{getStatusBadge(auctionData.status)}</div>
                  </div>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">Time Status</s-text>
                    <div>{getTimeStatus()}</div>
                  </div>
                </div>
              </div>
            </s-card>

            {/* Auction Details */}
            <s-card>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <s-text variant="headingMd">Auction Details</s-text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">Start Time</s-text>
                    <s-text variant="bodyLg">{formatDate(auctionData.startTime)}</s-text>
                  </div>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">End Time</s-text>
                    <s-text variant="bodyLg">{formatDate(auctionData.endTime)}</s-text>
                  </div>
                </div>
                <s-divider />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">Starting Bid</s-text>
                    <s-text variant="bodyLg">{formatCurrency(auctionData.startingBid)}</s-text>
                  </div>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">Current Bid</s-text>
                    <s-text variant="bodyLg" fontWeight="semibold">
                      {formatCurrency(auctionData.currentBid)}
                    </s-text>
                  </div>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">Buy Now Price</s-text>
                    <s-text variant="bodyLg">
                      {auctionData.buyNowPrice ? formatCurrency(auctionData.buyNowPrice) : 'Not set'}
                    </s-text>
                  </div>
                </div>
                <s-divider />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">Total Bids</s-text>
                    <s-text variant="bodyLg">{auctionData.bidHistory?.length || 0}</s-text>
                  </div>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">Created</s-text>
                    <s-text variant="bodyLg">{formatDate(auctionData.createdAt)}</s-text>
                  </div>
                  <div>
                    <s-text variant="bodyMd" tone="subdued">Last Updated</s-text>
                    <s-text variant="bodyLg">{formatDate(auctionData.updatedAt)}</s-text>
                  </div>
                </div>
              </div>
            </s-card>

            {/* Bid History */}
            {bidHistoryRows.length > 0 ? (
              <s-card>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <s-text variant="headingMd">Bid History</s-text>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e1e3e5' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}><s-text variant="bodyMd">#</s-text></th>
                        <th style={{ padding: '12px', textAlign: 'left' }}><s-text variant="bodyMd">Bidder</s-text></th>
                        <th style={{ padding: '12px', textAlign: 'left' }}><s-text variant="bodyMd">Amount</s-text></th>
                        <th style={{ padding: '12px', textAlign: 'left' }}><s-text variant="bodyMd">Time</s-text></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bidHistoryRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f2f3' }}>
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} style={{ padding: '12px' }}>
                              <s-text variant="bodyMd">{cell}</s-text>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </s-card>
            ) : (
              <s-card>
                <div style={{ padding: '16px' }}>
                  <s-text variant="bodyMd" tone="subdued">
                    No bids placed yet
                  </s-text>
                </div>
              </s-card>
            )}

            {/* Actions */}
            {auctionData.status === 'active' && (
              <s-card>
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <s-button onClick={fetchAuctionDetails} loading={loading}>
                      Refresh
                    </s-button>
                    <s-button onClick={handleCloseAuction} tone="critical">
                      Close Auction
                    </s-button>
                  </div>
                </div>
              </s-card>
            )}
          </div>
        </s-modal-content>
        <s-modal-footer>
          <s-button variant="secondary" onClick={onClose}>
            Close
          </s-button>
        </s-modal-footer>
      </s-modal>

      {showToast && (
        <s-toast
          content={toastMessage}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </>
  );
};

export default AuctionDetails;
