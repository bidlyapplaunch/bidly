import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Text,
  Button,
  DataTable,
  Badge,
  Divider,
  TextContainer
} from '@shopify/polaris';
import { format } from 'date-fns';
import { auctionAPI } from '../services/api';
import AppBridgeToast from './AppBridgeToast';
import useAdminI18n from '../hooks/useAdminI18n';

const AuctionDetails = ({ isOpen, onClose, auction, onRefresh }) => {
  const i18n = useAdminI18n();
  const [auctionData, setAuctionData] = useState(auction);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
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
      console.log('✅ Auction details fetched, full response:', response);
      
      // auctionAPI.getAuctionById returns response.data from axios
      // Backend returns: { success: true, data: {...auction object...} }
      // So response will be: { success: true, data: {...} }
      let data;
      if (response.success && response.data) {
        data = response.data;
      } else if (response.data) {
        // Fallback: response might already be the data object
        data = response.data;
      } else {
        data = response;
      }
      
      console.log('✅ Extracted auction data:', data);
      console.log('✅ Auction ID in data:', data?._id || data?.id);
      setAuctionData(data);
    } catch (error) {
      console.error('❌ Error fetching auction details:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAuction = async () => {
    try {
      // Try multiple possible ID fields - prioritize auctionData since it's the fetched data
      const auctionId = auctionData?._id || auctionData?.id || auction?._id || auction?.id;
      
      console.log('🔍 Attempting to close auction. Available IDs:');
      console.log('  - auctionData?._id:', auctionData?._id);
      console.log('  - auctionData?.id:', auctionData?.id);
      console.log('  - auction?._id:', auction?._id);
      console.log('  - auction?.id:', auction?.id);
      console.log('  - Selected ID:', auctionId);
      
      if (!auctionId) {
        console.error('❌ No auction ID found. auctionData:', auctionData, 'auction:', auction);
        setToastMessage(i18n.translate('admin.auctions.details.errors.missingId'));
        setToastError(true);
        setShowToast(true);
        return;
      }
      
      console.log('🔍 Closing auction with ID:', auctionId);
      await auctionAPI.closeAuction(auctionId);
      setToastMessage(i18n.translate('admin.auctions.details.toast.closed'));
      setToastError(false);
      setShowToast(true);
      fetchAuctionDetails();
      onRefresh?.();
    } catch (error) {
      console.error('Error closing auction:', error);
      setToastMessage(
        i18n.translate('admin.auctions.details.errors.close', {
          message: error.response?.data?.message || error.message
        })
      );
      setToastError(true);
      setShowToast(true);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(i18n.locale || 'en', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date) => {
    return format(new Date(date), 'MMM dd, yyyy HH:mm:ss');
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { status: 'success', children: i18n.translate('admin.analytics.status.active') },
      closed: { status: 'critical', children: i18n.translate('admin.analytics.status.closed') }
    };
    return <Badge {...statusMap[status]} />;
  };

  const getTimeStatus = () => {
    if (!auctionData) return null;
    
    const now = new Date();
    const start = new Date(auctionData.startTime);
    const end = new Date(auctionData.endTime);
    
    if (now < start) {
      return <Badge status="info">{i18n.translate('admin.auctions.details.timeStatus.notStarted')}</Badge>;
    } else if (now > end) {
      return <Badge status="critical">{i18n.translate('admin.analytics.status.ended')}</Badge>;
    } else {
      return <Badge status="success">{i18n.translate('admin.auctions.details.timeStatus.live')}</Badge>;
    }
  };

  const getChatStatus = () => {
    const enabled = auctionData?.chatEnabled !== false;
    return (
      <Badge status={enabled ? 'success' : 'attention'}>
        {enabled ? i18n.translate('admin.common.enabled') : i18n.translate('admin.common.disabled')}
      </Badge>
    );
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
        bid.customerEmail || i18n.translate('admin.common.notAvailable'), // Show customer email for admin
        formatCurrency(bid.amount),
        formatDate(bid.timestamp)
      ]);
  };

  if (!auctionData) {
    return null;
  }

  const bidHistoryRows = getBidHistoryRows();

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        title={i18n.translate('admin.auctions.details.title')}
        primaryAction={{
          content: i18n.translate('admin.common.close'),
          onAction: onClose
        }}
        large
      >
        <Modal.Section>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Auction Overview */}
            <Card sectioned>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Text variant="headingMd">{i18n.translate('admin.auctions.details.overview.title')}</Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.overview.productId')}</Text>
                    <Text variant="bodyLg">{auctionData.shopifyProductId}</Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.overview.status')}</Text>
                    <div>{getStatusBadge(auctionData.status)}</div>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.overview.timeStatus')}</Text>
                    <div>{getTimeStatus()}</div>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.overview.chat')}</Text>
                    <div>{getChatStatus()}</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Auction Details */}
            <Card sectioned>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Text variant="headingMd">{i18n.translate('admin.auctions.details.details.title')}</Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.startTime')}</Text>
                    <Text variant="bodyLg">{formatDate(auctionData.startTime)}</Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.endTime')}</Text>
                    <Text variant="bodyLg">{formatDate(auctionData.endTime)}</Text>
                  </div>
                </div>
                <Divider />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.startingBid')}</Text>
                    <Text variant="bodyLg">{formatCurrency(auctionData.startingBid)}</Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.currentBid')}</Text>
                    <Text variant="bodyLg" fontWeight="bold">
                      {formatCurrency(auctionData.currentBid)}
                    </Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.buyNow')}</Text>
                    <Text variant="bodyLg">
                      {auctionData.buyNowPrice ? formatCurrency(auctionData.buyNowPrice) : i18n.translate('admin.common.notSet')}
                    </Text>
                  </div>
                </div>
                <Divider />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.totalBids')}</Text>
                    <Text variant="bodyLg">{auctionData.bidHistory?.length || 0}</Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.created')}</Text>
                    <Text variant="bodyLg">{formatDate(auctionData.createdAt)}</Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.updated')}</Text>
                    <Text variant="bodyLg">{formatDate(auctionData.updatedAt)}</Text>
                  </div>
                </div>
                <Divider />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.reserve')}</Text>
                    <Text variant="bodyLg">
                      {auctionData.reservePrice && auctionData.reservePrice > 0
                        ? formatCurrency(auctionData.reservePrice)
                        : i18n.translate('admin.common.notSet')}
                    </Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.popcorn')}</Text>
                    <Text variant="bodyLg">
                      {auctionData.popcornEnabled
                        ? i18n.translate('admin.common.enabled')
                        : i18n.translate('admin.common.disabled')}
                    </Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">{i18n.translate('admin.auctions.details.details.popcornSettings')}</Text>
                    {auctionData.popcornEnabled ? (
                      <Text variant="bodyLg">
                        {i18n.translate('admin.auctions.details.details.popcornSummary', {
                          trigger: auctionData.popcornTriggerSeconds || 0,
                          extend: auctionData.popcornExtendSeconds || 0
                        })}
                      </Text>
                    ) : (
                      <Text variant="bodyLg">{i18n.translate('admin.common.notConfigured')}</Text>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Bid History */}
            {bidHistoryRows.length > 0 ? (
              <Card sectioned>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Text variant="headingMd">{i18n.translate('admin.auctions.details.bidHistory.title')}</Text>
                  <DataTable
                    columnContentTypes={['numeric', 'text', 'text', 'text', 'text']}
                    headings={[
                      i18n.translate('admin.auctions.details.bidHistory.columns.index'),
                      i18n.translate('admin.auctions.details.bidHistory.columns.bidder'),
                      i18n.translate('admin.auctions.details.bidHistory.columns.email'),
                      i18n.translate('admin.auctions.details.bidHistory.columns.amount'),
                      i18n.translate('admin.auctions.details.bidHistory.columns.time')
                    ]}
                    rows={bidHistoryRows}
                  />
                </div>
              </Card>
            ) : (
              <Card sectioned>
                <TextContainer>
                  <Text variant="bodyMd" color="subdued">
                    {i18n.translate('admin.auctions.details.bidHistory.empty')}
                  </Text>
                </TextContainer>
              </Card>
            )}

            {/* Actions */}
            {auctionData.status === 'active' && (
              <Card sectioned>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                  <Button onClick={fetchAuctionDetails} loading={loading}>
                    {i18n.translate('admin.common.refresh')}
                  </Button>
                  <Button onClick={handleCloseAuction} destructive>
                    {i18n.translate('admin.auctions.details.actions.close')}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </Modal.Section>
      </Modal>

      {showToast && (
        <AppBridgeToast
          message={toastMessage}
          isError={toastError}
          duration={6000}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </>
  );
};

export default AuctionDetails;
