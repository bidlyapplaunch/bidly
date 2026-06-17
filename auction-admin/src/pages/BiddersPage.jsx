import { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Card,
  DataTable,
  TextField,
  Select,
  Spinner,
  Banner,
  Text,
  Badge,
  Button,
  ButtonGroup,
  Pagination,
  Box,
  InlineStack,
  BlockStack,
  Divider,
  EmptyState,
} from '@shopify/polaris';
import { SearchMinor } from '@shopify/polaris-icons';
import { biddersAPI, auctionAPI } from '../services/api';

const PAGE_SIZE = 25;

const fmt = (amount) =>
  amount != null ? `$${Number(amount).toFixed(2)}` : '—';

const fmtDate = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function BiddersPage() {
  const [tab, setTab] = useState('all');

  // ── All Bidders tab state ────────────────────────────────────────
  const [bidders, setBidders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadingAll, setLoadingAll] = useState(false);
  const [allError, setAllError] = useState(null);

  // ── Auction Bidders tab state ────────────────────────────────────
  const [auctions, setAuctions] = useState([]);
  const [selectedAuction, setSelectedAuction] = useState('');
  const [auctionBidders, setAuctionBidders] = useState(null);
  const [auctionTitle, setAuctionTitle] = useState('');
  const [loadingAuction, setLoadingAuction] = useState(false);
  const [auctionError, setAuctionError] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Load all bidders
  const fetchBidders = useCallback(async () => {
    setLoadingAll(true);
    setAllError(null);
    try {
      const data = await biddersAPI.getAllBidders({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });
      setBidders(data.customers || []);
      setTotal(data.total || 0);
    } catch {
      setAllError('Failed to load bidders. Please try again.');
    } finally {
      setLoadingAll(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    if (tab === 'all') fetchBidders();
  }, [tab, fetchBidders]);

  // Load auctions for dropdown
  useEffect(() => {
    if (tab === 'auction' && auctions.length === 0) {
      auctionAPI.getAllAuctions({ limit: 100 })
        .then((data) => {
          const list = (data.auctions || data.data || []).map((a) => ({
            label: a.productTitle || a.title || a._id,
            value: a._id,
          }));
          setAuctions([{ label: 'Select an auction…', value: '' }, ...list]);
        })
        .catch(() => setAuctions([{ label: 'Failed to load auctions', value: '' }]));
    }
  }, [tab, auctions.length]);

  // Load bidders for selected auction
  useEffect(() => {
    if (!selectedAuction) {
      setAuctionBidders(null);
      return;
    }
    setLoadingAuction(true);
    setAuctionError(null);
    biddersAPI.getAuctionBidders(selectedAuction)
      .then((data) => {
        setAuctionBidders(data.bidders || []);
        setAuctionTitle(data.auctionTitle || '');
      })
      .catch(() => setAuctionError('Failed to load auction bidders.'))
      .finally(() => setLoadingAuction(false));
  }, [selectedAuction]);

  // ── All Bidders table ────────────────────────────────────────────
  const allBiddersRows = bidders.map((b) => [
    b.displayName || [b.firstName, b.lastName].filter(Boolean).join(' ') || '—',
    b.email || '—',
    b.phone || '—',
    b.totalBids ?? 0,
    b.auctionsWon ?? 0,
    fmt(b.totalBidAmount),
  ]);

  // ── Auction Bidders table ────────────────────────────────────────
  const auctionBiddersRows = (auctionBidders || []).map((b) => [
    <Badge key={b.rank} tone={b.rank === 1 ? 'success' : b.rank === 2 ? 'warning' : undefined}>
      #{b.rank}
    </Badge>,
    b.name || '—',
    b.email || '—',
    b.phone || '—',
    fmt(b.highestBid),
    fmtDate(b.timestamp),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Page title="Bidders">
      <BlockStack gap="400">
        {/* Tab switcher */}
        <Card>
          <ButtonGroup variant="segmented">
            <Button
              pressed={tab === 'all'}
              onClick={() => setTab('all')}
            >
              All Bidders
            </Button>
            <Button
              pressed={tab === 'auction'}
              onClick={() => setTab('auction')}
            >
              By Auction
            </Button>
          </ButtonGroup>
        </Card>

        {/* ── All Bidders ──────────────────────────────────────── */}
        {tab === 'all' && (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">
                  All Bidders {total > 0 && <Text as="span" tone="subdued">({total})</Text>}
                </Text>
                <Box width="300px">
                  <TextField
                    label=""
                    labelHidden
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={setSearch}
                    prefix={<SearchMinor />}
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setSearch('')}
                  />
                </Box>
              </InlineStack>

              {allError && (
                <Banner tone="critical">{allError}</Banner>
              )}

              {loadingAll ? (
                <Box padding="800" as="div">
                  <InlineStack align="center"><Spinner /></InlineStack>
                </Box>
              ) : bidders.length === 0 ? (
                <EmptyState
                  heading="No bidders yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Bidders who register via your auction widget will appear here.</p>
                </EmptyState>
              ) : (
                <>
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric', 'numeric']}
                    headings={['Name', 'Email', 'Phone', 'Total Bids', 'Won', 'Total Bid Amount']}
                    rows={allBiddersRows}
                    hoverable
                  />
                  {totalPages > 1 && (
                    <>
                      <Divider />
                      <InlineStack align="center">
                        <Pagination
                          hasPrevious={page > 1}
                          onPrevious={() => setPage((p) => p - 1)}
                          hasNext={page < totalPages}
                          onNext={() => setPage((p) => p + 1)}
                          label={`Page ${page} of ${totalPages}`}
                        />
                      </InlineStack>
                    </>
                  )}
                </>
              )}
            </BlockStack>
          </Card>
        )}

        {/* ── By Auction ──────────────────────────────────────── */}
        {tab === 'auction' && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Ranked Bidders by Auction</Text>
              <Text tone="subdued">
                Select an auction to see all bidders ranked by their highest bid — useful for contacting
                the 2nd or 3rd place bidder if the winner does not claim their item.
              </Text>

              <Select
                label="Auction"
                options={auctions.length ? auctions : [{ label: 'Loading…', value: '' }]}
                value={selectedAuction}
                onChange={setSelectedAuction}
              />

              {auctionError && <Banner tone="critical">{auctionError}</Banner>}

              {loadingAuction && (
                <Box padding="800">
                  <InlineStack align="center"><Spinner /></InlineStack>
                </Box>
              )}

              {!loadingAuction && auctionBidders && auctionBidders.length === 0 && (
                <Banner tone="info">No bids have been placed on this auction yet.</Banner>
              )}

              {!loadingAuction && auctionBidders && auctionBidders.length > 0 && (
                <>
                  <Text variant="headingSm" as="h3">{auctionTitle}</Text>
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'text', 'numeric', 'text']}
                    headings={['Rank', 'Name', 'Email', 'Phone', 'Highest Bid', 'Last Bid']}
                    rows={auctionBiddersRows}
                    hoverable
                  />
                  <Banner tone="info">
                    <Text>
                      To contact the runner-up, use the phone number or email in rank #2. Their bid of{' '}
                      <strong>{fmt(auctionBidders[1]?.highestBid)}</strong> is the next accepted offer.
                    </Text>
                  </Banner>
                </>
              )}
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
