import { awsConnectionService, type AWSConnection } from '@/services/aws-connection.service';
import { TokenStorage } from '@/utils/token-storage';
import { useEffect, useState } from 'react';
import './AWSConnectionStatus.css';
import { AWSConnectionWizard } from './AWSConnectionWizard';

export function AWSConnectionStatus() {
  const [connection, setConnection] = useState<AWSConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadConnection = async () => {
    const accessToken = TokenStorage.getIdToken();
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await awsConnectionService.getConnection(accessToken);
      setConnection(response.connection);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connection');
      setConnection(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnection();
  }, []);

  const handleConnected = (newConnection: AWSConnection) => {
    setConnection(newConnection);
    setShowWizard(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);

    const accessToken = TokenStorage.getIdToken();
    if (!accessToken) {
      setError('Not authenticated');
      setRefreshing(false);
      return;
    }

    try {
      const response = await awsConnectionService.refresh(accessToken);
      setConnection(response.connection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh connection');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your AWS account? You will need to reconnect it to deploy resources.')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    const accessToken = TokenStorage.getIdToken();
    if (!accessToken) {
      setError('Not authenticated');
      setDisconnecting(false);
      return;
    }

    try {
      await awsConnectionService.disconnect(accessToken);
      setConnection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="aws-connection-status loading">
        <div className="status-spinner"></div>
        <span>Loading AWS connection...</span>
      </div>
    );
  }

  return (
    <>
      <div className="aws-connection-status">
        {error && (
          <div className="status-error">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {!connection && !error && (
          <div className="status-disconnected">
            <div className="status-icon">☁️</div>
            <div className="status-content">
              <h4>No AWS Account Connected</h4>
              <p>Connect your AWS account to deploy CloudFormation templates.</p>
              <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
                Connect AWS Account
              </button>
            </div>
          </div>
        )}

        {connection && (
          <div className={`status-connected ${connection.status}`}>
            <div className="status-icon">
              {connection.status === 'connected' && '✓'}
              {connection.status === 'expiring' && '⏰'}
              {connection.status === 'expired' && '❌'}
            </div>
            <div className="status-content">
              <h4>
                {connection.status === 'connected' && 'AWS Account Connected'}
                {connection.status === 'expiring' && 'Connection Expiring Soon'}
                {connection.status === 'expired' && 'Connection Expired'}
              </h4>
              <div className="connection-info">
                <div className="info-row">
                  <span className="info-label">Account:</span>
                  <span className="info-value">{connection.accountAlias}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Account ID:</span>
                  <span className="info-value">{connection.accountId}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Expires:</span>
                  <span className="info-value">
                    {new Date(connection.expiresAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="status-actions">
                {(connection.status === 'expiring' || connection.status === 'expired') && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    {refreshing ? 'Refreshing...' : '🔄 Refresh Connection'}
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showWizard && (
        <AWSConnectionWizard
          onClose={() => setShowWizard(false)}
          onConnected={handleConnected}
        />
      )}
    </>
  );
}
