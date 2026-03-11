import React, { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Card,
  Text,
  Button,
  Badge,
  Banner,
  Modal,
  Spinner,
  Box,
  InlineStack,
  BlockStack
} from '@shopify/polaris';
import { DeleteMinor } from '@shopify/polaris-icons';
import { chatAPI } from '../services/api';
import useAdminI18n from '../hooks/useAdminI18n';

const AUTO_REFRESH_INTERVAL_MS = 10000;

export default function ChatMonitorPage() {
  const i18n = useAdminI18n();
  const [data, setData] = useState({ auctions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await chatAPI.getMonitor();
      setData(result || { auctions: [] });
    } catch (err) {
      console.error('Chat monitor fetch error:', err);
      setError(i18n.translate('admin.chatMonitor.loadError'));
      setData({ auctions: [] });
    } finally {
      setLoading(false);
    }
  }, [i18n]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const id = setInterval(fetchData, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleDeleteMessage = async (productId, messageId) => {
    try {
      await chatAPI.deleteMessage(productId, messageId);
      await fetchData();
    } catch (err) {
      console.error('Delete message error:', err);
      setError(i18n.translate('admin.chatMonitor.loadError'));
    }
  };

  const handleClearAll = async () => {
    if (!clearTarget) return;
    try {
      await chatAPI.clearAllMessages(clearTarget.productId);
      setClearModalOpen(false);
      setClearTarget(null);
      await fetchData();
    } catch (err) {
      console.error('Clear all error:', err);
      setError(i18n.translate('admin.chatMonitor.loadError'));
    }
  };

  if (loading && data.auctions?.length === 0) {
    return (
      <Page title={i18n.translate('admin.chatMonitor.title')}>
        <Card sectioned>
          <Box padding="800">
            <InlineStack align="center" gap="400">
              <Spinner size="small" />
              <Text as="p" tone="subdued">
                {i18n.translate('admin.common.loadingApp')}
              </Text>
            </InlineStack>
          </Box>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title={i18n.translate('admin.chatMonitor.title')}
      subtitle={i18n.translate('admin.chatMonitor.description')}
    >
      <BlockStack gap="400">
        <Text as="p" tone="subdued">
          {i18n.translate('admin.chatMonitor.autoRefresh')}
        </Text>

        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {data.auctions?.length === 0 ? (
          <Card sectioned>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                {i18n.translate('admin.chatMonitor.empty')}
              </Text>
              <Text as="p" tone="subdued">
                {i18n.translate('admin.chatMonitor.emptyDescription')}
              </Text>
            </BlockStack>
          </Card>
        ) : (
          data.auctions?.map((auction) => (
            <Card key={auction.auctionId}>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h2">
                      {auction.productTitle || auction.shopifyProductId}
                    </Text>
                    <Text as="p" tone="subdued">
                      {i18n.translate('admin.chatMonitor.product')}: {auction.shopifyProductId}
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200">
                    <Badge status={auction.status === 'active' ? 'success' : auction.status === 'ended' ? 'critical' : 'info'}>
                      {auction.status}
                    </Badge>
                    <Button
                      tone="critical"
                      variant="plain"
                      icon={DeleteMinor}
                      onClick={() => {
                        setClearTarget({ productId: auction.shopifyProductId, title: auction.productTitle });
                        setClearModalOpen(true);
                      }}
                      disabled={auction.messages?.length === 0}
                    >
                      {i18n.translate('admin.chatMonitor.clearAll')}
                    </Button>
                  </InlineStack>
                </InlineStack>

                {(!auction.messages || auction.messages.length === 0) ? (
                  <Text as="p" tone="subdued">
                    {i18n.translate('admin.chatMonitor.messages')}: 0
                  </Text>
                ) : (
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">
                      {i18n.translate('admin.chatMonitor.messages')} ({auction.messages.length})
                    </Text>
                    {auction.messages.map((msg) => (
                      <Box
                        key={msg.id}
                        padding="300"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <Text as="p" fontWeight="semibold">
                              {msg.username}
                            </Text>
                            <Text as="p">{msg.message}</Text>
                            <Text as="p" tone="subdued" variant="bodySm">
                              {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                            </Text>
                          </BlockStack>
                          <Button
                            tone="critical"
                            size="slim"
                            onClick={() => handleDeleteMessage(auction.shopifyProductId, msg.id)}
                          >
                            {i18n.translate('admin.chatMonitor.deleteMessage')}
                          </Button>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          ))
        )}
      </BlockStack>

      <Modal
        open={clearModalOpen}
        onClose={() => {
          setClearModalOpen(false);
          setClearTarget(null);
        }}
        title={i18n.translate('admin.chatMonitor.clearAllConfirm')}
        primaryAction={{
          content: i18n.translate('admin.chatMonitor.clearAll'),
          destructive: true,
          onAction: handleClearAll
        }}
        secondaryActions={[
          {
            content: i18n.translate('admin.common.cancel'),
            onAction: () => {
              setClearModalOpen(false);
              setClearTarget(null);
            }
          }
        ]}
      >
        <Modal.Section>
          <Text as="p">
            {clearTarget?.title
              ? `Clear all messages for "${clearTarget.title}"?`
              : i18n.translate('admin.chatMonitor.clearAllConfirm')}
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
