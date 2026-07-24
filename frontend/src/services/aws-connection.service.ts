import { API_BASE_URL } from '@/config';

export interface AWSConnectionRequest {
  roleArn: string;
  externalId?: string;
  accountAlias?: string;
}

export interface AWSConnection {
  accountId: string;
  accountAlias: string;
  roleArn: string;
  expiresAt: string;
  status: 'connected' | 'expiring' | 'expired';
}

export interface ConnectAWSResponse {
  message: string;
  connection: AWSConnection;
}

export interface GetConnectionResponse {
  connection: AWSConnection | null;
  message?: string;
}

class AWSConnectionService {
  /**
   * Connect to an AWS account using IAM Role ARN
   */
  async connect(request: AWSConnectionRequest, accessToken: string): Promise<ConnectAWSResponse> {
    const response = await fetch(`${API_BASE_URL}/api/aws-connection/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to connect AWS account');
    }

    return response.json();
  }

  /**
   * Get current AWS connection status
   */
  async getConnection(accessToken: string): Promise<GetConnectionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/aws-connection/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get connection status');
    }

    return response.json();
  }

  /**
   * Refresh AWS connection credentials
   */
  async refresh(accessToken: string): Promise<ConnectAWSResponse> {
    const response = await fetch(`${API_BASE_URL}/api/aws-connection/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to refresh connection');
    }

    return response.json();
  }

  /**
   * Disconnect AWS account
   */
  async disconnect(accessToken: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/aws-connection/disconnect`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to disconnect AWS account');
    }

    return response.json();
  }

  /**
   * Check if credentials are expiring soon (within 10 minutes)
   */
  isExpiringSoon(connection: AWSConnection): boolean {
    const expiresAt = new Date(connection.expiresAt);
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
    return expiresAt < tenMinutesFromNow;
  }

  /**
   * Check if credentials are expired
   */
  isExpired(connection: AWSConnection): boolean {
    const expiresAt = new Date(connection.expiresAt);
    return expiresAt < new Date();
  }
}

export const awsConnectionService = new AWSConnectionService();
