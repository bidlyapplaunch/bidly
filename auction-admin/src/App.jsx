import React, { useState, useEffect } from 'react';
import { AppProvider, Page, Card, Text, Button, Layout, Banner, Spinner } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import { auctionAPI } from './services/api';

function Dashboard() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await auctionAPI.getAllAuctions();
      setAuctions(response.data || []);
    } catch (err) {
      setError('Failed to fetch auctions. Make sure the backend is running on port 5000.');
      console.error('Error fetching auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title="Auction Dashboard">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Text variant="headingLg">Welcome to Bidly Auction Admin</Text>
            <Text variant="bodyMd">
              Manage your auctions and monitor bid activity.
            </Text>
            <Button primary onClick={() => console.log('Create auction clicked')}>
              Create Auction
            </Button>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          {error && (
            <Banner status="critical">
              <Text variant="bodyMd">{error}</Text>
            </Banner>
          )}
          
          {loading ? (
            <Card sectioned>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Spinner size="large" />
                <Text variant="bodyMd" style={{ marginTop: '1rem' }}>
                  Loading auctions...
                </Text>
              </div>
            </Card>
          ) : (
            <Card sectioned>
              <Text variant="headingMd">Auctions</Text>
              <Text variant="bodyMd">
                Found {auctions.length} auctions
              </Text>
              {auctions.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  {auctions.map((auction, index) => (
                    <div key={auction.id || index} style={{ 
                      padding: '0.5rem', 
                      border: '1px solid #e1e3e5', 
                      marginBottom: '0.5rem',
                      borderRadius: '4px'
                    }}>
                      <Text variant="bodyMd">
                        <strong>{auction.shopifyProductId}</strong> - 
                        Starting Bid: ${auction.startingBid} - 
                        Status: {auction.status}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}

export default App;