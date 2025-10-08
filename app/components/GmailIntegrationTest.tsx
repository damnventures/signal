'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

import {
  GmailService,
  formatEmailForProcessing,
  formatThreadForProcessing,
  type GmailConnectionConfig,
  type EmailSearchQuery
} from '@/lib/gmail-service';

export default function GmailIntegrationTest() {
  const [config, setConfig] = useState<GmailConnectionConfig>({
    userConnectionId: ''
  });

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('project OR client OR meeting');
  const [timeframe, setTimeframe] = useState<string>('last_30_days');

  const gmailService = new GmailService();

  // Test connection to Composio
  const handleTestConnection = async () => {
    if (!config.userConnectionId) {
      setError('Please provide User Connection ID');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      gmailService.setConnectionConfig(config);
      const result = await gmailService.testConnection();

      setConnectionStatus(result);
      setIsConnected(result.success && result.connection?.connected);

      if (result.success && result.connection?.connected) {
        // Save config to localStorage for convenience
        localStorage.setItem('gmailConfig', JSON.stringify(config));
      }

    } catch (err: any) {
      setError(`Connection test failed: ${err.message}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Load saved config
  React.useEffect(() => {
    const savedConfig = localStorage.getItem('gmailConfig');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error('Failed to load saved config:', error);
      }
    }
  }, []);

  // Fetch business emails
  const handleFetchBusinessEmails = async () => {
    if (!isConnected) {
      setError('Please test connection first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await gmailService.fetchBusinessEmails(timeframe);
      setResults({
        type: 'business_emails',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      setError(`Failed to fetch business emails: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Search emails with custom query
  const handleSearchEmails = async () => {
    if (!isConnected) {
      setError('Please test connection first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const searchConfig: EmailSearchQuery = {
        searchQuery,
        timeframe: timeframe as any,
        includeThreads: true,
        maxResults: 50
      };

      const result = await gmailService.searchEmails(searchConfig);
      setResults({
        type: 'search_results',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      setError(`Failed to search emails: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch threads
  const handleFetchThreads = async () => {
    if (!isConnected) {
      setError('Please test connection first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await gmailService.fetchThreads(searchQuery, 25);
      setResults({
        type: 'threads',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      setError(`Failed to fetch threads: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch specific thread messages
  const handleFetchThreadMessages = async (threadId: string) => {
    setIsLoading(true);
    setError('');

    try {
      const result = await gmailService.fetchThreadMessages(threadId);
      setResults({
        type: 'thread_messages',
        data: result,
        threadId,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      setError(`Failed to fetch thread messages: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gmail Integration Test</CardTitle>
          <CardDescription>
            Test Gmail data fetching via Composio integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="connection" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="connection">Connection</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="threads">Threads</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            {/* Connection Tab */}
            <TabsContent value="connection" className="space-y-4">
              <div className="grid gap-4">
                <Alert>
                  <AlertDescription>
                    <strong>Setup:</strong> Your app's Composio API key should be configured in environment variables.
                    Users only need to provide their Connection ID after authenticating with Composio.
                  </AlertDescription>
                </Alert>

                <div>
                  <Label htmlFor="userConnectionId">User Connection ID</Label>
                  <Input
                    id="userConnectionId"
                    value={config.userConnectionId}
                    onChange={(e) => setConfig({...config, userConnectionId: e.target.value})}
                    placeholder="connection_id_after_user_authorizes_gmail"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This ID is generated when a user authorizes their Gmail access through Composio
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleTestConnection}
                    disabled={isLoading || !config.userConnectionId}
                  >
                    {isLoading ? 'Testing...' : 'Test Connection'}
                  </Button>

                  {isConnected && (
                    <Badge variant="default" className="bg-green-500">
                      Connected
                    </Badge>
                  )}
                </div>

                {connectionStatus && (
                  <Alert>
                    <AlertDescription>
                      <strong>Connection Status:</strong>
                      <pre className="mt-2 text-sm">
                        {JSON.stringify(connectionStatus, null, 2)}
                      </pre>
                    </AlertDescription>
                  </Alert>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>

            {/* Search Tab */}
            <TabsContent value="search" className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="searchQuery">Search Query</Label>
                  <Input
                    id="searchQuery"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="project OR client OR meeting"
                  />
                </div>

                <div>
                  <Label htmlFor="timeframe">Time Range</Label>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_7_days">Last 7 days</SelectItem>
                      <SelectItem value="last_30_days">Last 30 days</SelectItem>
                      <SelectItem value="last_90_days">Last 90 days</SelectItem>
                      <SelectItem value="last_6_months">Last 6 months</SelectItem>
                      <SelectItem value="last_year">Last year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleFetchBusinessEmails}
                    disabled={isLoading || !isConnected}
                  >
                    {isLoading ? 'Fetching...' : 'Fetch Business Emails'}
                  </Button>

                  <Button
                    onClick={handleSearchEmails}
                    disabled={isLoading || !isConnected}
                    variant="outline"
                  >
                    {isLoading ? 'Searching...' : 'Search Emails'}
                  </Button>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Gmail Query Preview:</strong>
                    <code className="block mt-2 p-2 bg-gray-100 rounded text-sm">
                      {searchQuery} newer_than:{timeframe.replace('last_', '').replace('_', '')} -in:spam -in:trash
                    </code>
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            {/* Threads Tab */}
            <TabsContent value="threads" className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Email Threads</h3>
                    <p className="text-sm text-gray-600">
                      Fetch and explore email conversation threads
                    </p>
                  </div>
                  <Button
                    onClick={handleFetchThreads}
                    disabled={isLoading || !isConnected}
                  >
                    {isLoading ? 'Fetching...' : 'Fetch Threads'}
                  </Button>
                </div>

                {results?.type === 'threads' && results.data?.threads && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Found {results.data.threads.length} threads:</h4>
                    {results.data.threads.slice(0, 10).map((thread: any) => (
                      <Card key={thread.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">Thread ID: {thread.id}</p>
                            <p className="text-xs text-gray-600">
                              {thread.messages?.length || 0} messages
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleFetchThreadMessages(thread.id)}
                          >
                            View Messages
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="space-y-4">
              {results ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      Results: {results.type.replace('_', ' ').toUpperCase()}
                    </h3>
                    <Badge variant="outline">
                      {results.timestamp}
                    </Badge>
                  </div>

                  <Separator />

                  {/* Summary Statistics */}
                  {results.data && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {results.data.emails && (
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{results.data.emails.length}</div>
                            <p className="text-xs text-muted-foreground">Emails Found</p>
                          </CardContent>
                        </Card>
                      )}
                      {results.data.threads && (
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{results.data.threads.length}</div>
                            <p className="text-xs text-muted-foreground">Threads Found</p>
                          </CardContent>
                        </Card>
                      )}
                      {results.data.messages && (
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{results.data.messages.length}</div>
                            <p className="text-xs text-muted-foreground">Messages in Thread</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Raw Results */}
                  <div>
                    <h4 className="font-medium mb-2">Raw Results:</h4>
                    <Textarea
                      value={JSON.stringify(results.data, null, 2)}
                      readOnly
                      rows={20}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No results yet. Test the connection and fetch some emails to see results here.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}