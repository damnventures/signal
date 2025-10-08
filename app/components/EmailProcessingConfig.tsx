'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

import {
  DEFAULT_FILTER_PROMPT,
  DEFAULT_PROCESSING_PROMPT,
  DEFAULT_UPDATE_PROMPT,
  EXAMPLE_CONFIGURATIONS,
  generateBusinessEmailQuery,
  type EmailPromptConfig
} from '@/lib/email-prompts';
import { EmailService, EmailWorkflow } from '@/lib/email-service';

interface EmailProcessingConfigProps {
  onConfigSave?: (config: EmailPromptConfig) => void;
  onProcessingStart?: () => void;
  onProcessingComplete?: (results: any) => void;
}

export default function EmailProcessingConfig({
  onConfigSave,
  onProcessingStart,
  onProcessingComplete
}: EmailProcessingConfigProps) {
  const [config, setConfig] = useState<EmailPromptConfig>({
    filterPrompt: DEFAULT_FILTER_PROMPT,
    processingPrompt: DEFAULT_PROCESSING_PROMPT,
    updatePrompt: DEFAULT_UPDATE_PROMPT,
    batchSize: 25,
    minThreadSize: 3
  });

  const [timeframe, setTimeframe] = useState('last_30_days');
  const [userDomains, setUserDomains] = useState<string>('');
  const [userEmail, setUserEmail] = useState('');
  const [composioToken, setComposioToken] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [results, setResults] = useState<any>(null);

  const emailService = new EmailService();
  const emailWorkflow = new EmailWorkflow(emailService);

  // Load example configuration
  const loadExampleConfig = (configName: string) => {
    const exampleConfig = EXAMPLE_CONFIGURATIONS[configName];
    if (exampleConfig) {
      setConfig(exampleConfig);
    }
  };

  // Save configuration
  const handleSaveConfig = () => {
    onConfigSave?.(config);
    // Could also save to localStorage
    localStorage.setItem('emailProcessingConfig', JSON.stringify(config));
  };

  // Load saved configuration
  useEffect(() => {
    const savedConfig = localStorage.getItem('emailProcessingConfig');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error('Failed to load saved config:', error);
      }
    }
  }, []);

  // Start email processing
  const handleStartProcessing = async () => {
    if (!userEmail || !composioToken) {
      alert('Please provide user email and Composio token');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStatus('Initializing email processing...');
    onProcessingStart?.();

    try {
      // Set up email service
      emailService.setComposioToken(composioToken);

      setProcessingProgress(20);
      setProcessingStatus('Fetching business emails...');

      // Process business emails
      const domains = userDomains.split(',').map(d => d.trim()).filter(Boolean);
      const processingResult = await emailService.processBusinessEmails(
        userEmail,
        config,
        timeframe,
        domains
      );

      setProcessingProgress(100);
      setProcessingStatus('Processing complete!');
      setResults(processingResult);
      onProcessingComplete?.(processingResult);

    } catch (error) {
      console.error('Email processing failed:', error);
      setProcessingStatus(`Processing failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate preview of Gmail query
  const generateQueryPreview = () => {
    const domains = userDomains.split(',').map(d => d.trim()).filter(Boolean);
    return generateBusinessEmailQuery(timeframe, domains);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Processing Configuration</CardTitle>
          <CardDescription>
            Configure how emails are filtered, processed, and organized into capsules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="prompts">Prompts</TabsTrigger>
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            {/* Setup Tab */}
            <TabsContent value="setup" className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="userEmail">Your Email Address</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="your.email@company.com"
                  />
                </div>

                <div>
                  <Label htmlFor="composioToken">Composio API Token</Label>
                  <Input
                    id="composioToken"
                    type="password"
                    value={composioToken}
                    onChange={(e) => setComposioToken(e.target.value)}
                    placeholder="your_composio_token"
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

                <div>
                  <Label htmlFor="userDomains">Domain Filter (optional)</Label>
                  <Input
                    id="userDomains"
                    value={userDomains}
                    onChange={(e) => setUserDomains(e.target.value)}
                    placeholder="company.com, client.com (comma-separated)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="batchSize">Batch Size</Label>
                    <Input
                      id="batchSize"
                      type="number"
                      value={config.batchSize}
                      onChange={(e) => setConfig({...config, batchSize: parseInt(e.target.value)})}
                      min="10"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="minThreadSize">Min Thread Size</Label>
                    <Input
                      id="minThreadSize"
                      type="number"
                      value={config.minThreadSize}
                      onChange={(e) => setConfig({...config, minThreadSize: parseInt(e.target.value)})}
                      min="1"
                      max="10"
                    />
                  </div>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Gmail Query Preview:</strong>
                    <code className="block mt-2 p-2 bg-gray-100 rounded text-sm">
                      {generateQueryPreview()}
                    </code>
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            {/* Prompts Tab */}
            <TabsContent value="prompts" className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadExampleConfig('conservative')}
                >
                  Conservative
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadExampleConfig('aggressive')}
                >
                  Aggressive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadExampleConfig('client_focused')}
                >
                  Client Focused
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="filterPrompt">Email Classification Prompt</Label>
                  <Textarea
                    id="filterPrompt"
                    value={config.filterPrompt}
                    onChange={(e) => setConfig({...config, filterPrompt: e.target.value})}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="processingPrompt">Thread Processing Prompt</Label>
                  <Textarea
                    id="processingPrompt"
                    value={config.processingPrompt}
                    onChange={(e) => setConfig({...config, processingPrompt: e.target.value})}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="updatePrompt">Document Update Prompt</Label>
                  <Textarea
                    id="updatePrompt"
                    value={config.updatePrompt}
                    onChange={(e) => setConfig({...config, updatePrompt: e.target.value})}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>

                <Button onClick={handleSaveConfig}>Save Configuration</Button>
              </div>
            </TabsContent>

            {/* Process Tab */}
            <TabsContent value="process" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Start Email Processing</h3>
                    <p className="text-sm text-gray-600">
                      Process business emails from the last {timeframe.replace('_', ' ')}
                    </p>
                  </div>
                  <Button
                    onClick={handleStartProcessing}
                    disabled={isProcessing || !userEmail || !composioToken}
                  >
                    {isProcessing ? 'Processing...' : 'Start Processing'}
                  </Button>
                </div>

                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={processingProgress} />
                    <p className="text-sm text-gray-600">{processingStatus}</p>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Configuration Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Batch Size:</span>
                        <Badge variant="secondary">{config.batchSize}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Min Thread Size:</span>
                        <Badge variant="secondary">{config.minThreadSize}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Time Range:</span>
                        <Badge variant="outline">{timeframe}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Processing Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        {isProcessing ? 'In Progress...' : 'Ready to Process'}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="space-y-4">
              {results ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Processing Results</h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{results.summary?.create_new || 0}</div>
                        <p className="text-xs text-muted-foreground">New Capsules</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{results.summary?.update_existing || 0}</div>
                        <p className="text-xs text-muted-foreground">Updated Capsules</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{results.summary?.archive || 0}</div>
                        <p className="text-xs text-muted-foreground">Archived Emails</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{results.summary?.ignore || 0}</div>
                        <p className="text-xs text-muted-foreground">Ignored Emails</p>
                      </CardContent>
                    </Card>
                  </div>

                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No processing results yet. Run email processing to see results here.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}