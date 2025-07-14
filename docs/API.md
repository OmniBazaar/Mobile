# Mobile API Documentation

## Overview

This document describes the API integration patterns and endpoints used in the OmniBazaar Mobile application.

## Base Configuration

```typescript
const API_CONFIG = {
  baseURL: process.env.API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};
```

## Authentication

### JWT Token Management
- Access token stored in secure storage
- Refresh token for automatic renewal
- Biometric protection for token access

### API Endpoints

#### POST /auth/login
```typescript
interface LoginRequest {
  email: string;
  password: string;
  deviceId: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
```

#### POST /auth/biometric-setup
```typescript
interface BiometricSetupRequest {
  publicKey: string;
  deviceFingerprint: string;
}
```

## Wallet API

### GET /wallet/balances
```typescript
interface BalanceResponse {
  balances: Array<{
    assetId: string;
    symbol: string;
    balance: string;
    usdValue: number;
  }>;
}
```

### POST /wallet/send
```typescript
interface SendRequest {
  to: string;
  amount: string;
  assetId: string;
  memo?: string;
  biometricSignature: string;
}
```

## Marketplace API

### GET /marketplace/products
```typescript
interface ProductsRequest {
  page: number;
  limit: number;
  category?: string;
  search?: string;
  location?: {
    lat: number;
    lng: number;
    radius: number;
  };
}
```

### POST /marketplace/orders
```typescript
interface CreateOrderRequest {
  productId: string;
  quantity: number;
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
}
```

## DEX API

### GET /dex/markets
```typescript
interface Market {
  id: string;
  baseAsset: string;
  quoteAsset: string;
  price: string;
  volume24h: string;
  change24h: number;
}
```

### POST /dex/orders
```typescript
interface OrderRequest {
  marketId: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: string;
  price?: string;
}
```

## Chat API

### WebSocket Connection
```typescript
// Connect to chat WebSocket
const chatSocket = new WebSocket(WS_BASE_URL + '/chat');

// Message types
interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'file';
}
```

## Push Notifications

### Firebase Cloud Messaging
```typescript
interface NotificationPayload {
  title: string;
  body: string;
  data: {
    type: 'order' | 'message' | 'price_alert';
    entityId: string;
  };
}
```

## Error Handling

### Standard Error Response
```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}
```

### Common Error Codes
- `AUTH_REQUIRED`: Authentication required
- `INVALID_TOKEN`: Token expired or invalid
- `INSUFFICIENT_BALANCE`: Not enough funds
- `BIOMETRIC_FAILED`: Biometric authentication failed
- `NETWORK_ERROR`: Connection issues

## Rate Limiting

- Standard endpoints: 100 requests/minute
- Trading endpoints: 10 requests/second
- Authentication endpoints: 5 attempts/minute

## Offline Support

### Request Queueing
- Failed requests queued locally
- Automatic retry when connection restored
- Conflict resolution for data synchronization

This API documentation will be updated as new endpoints are added and existing ones are modified.