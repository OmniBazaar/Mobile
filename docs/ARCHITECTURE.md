# Mobile Architecture Guide

## Overview

This document outlines the architectural decisions and patterns used in the OmniBazaar Mobile application.

## Table of Contents

1. [Project Structure](#project-structure)
2. [State Management](#state-management)
3. [Navigation](#navigation)
4. [API Layer](#api-layer)
5. [Security](#security)
6. [Performance](#performance)
7. [Testing](#testing)

## Project Structure

The mobile app follows a feature-based folder structure with shared components and utilities.

```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components organized by feature
├── navigation/         # Navigation configuration and routing
├── services/           # Business logic and external service integration
├── store/             # Redux store, slices, and state management
├── native/            # Platform-specific code (iOS/Android)
├── theme/             # Design system and styling
└── utils/             # Utility functions and helpers
```

## State Management

### Redux Toolkit
- Centralized state management using Redux Toolkit
- Shared slices with web extension for consistency
- RTK Query for server state management

### Local Storage
- Secure storage for sensitive data (keys, tokens)
- AsyncStorage for user preferences
- WatermelonDB for offline-first data persistence

## Navigation

### React Navigation
- Bottom tab navigation for main sections
- Stack navigators for each feature area
- Deep linking support for external app integration
- Navigation state persistence

### Navigation Structure
```
Root Navigator (Stack)
├── Auth Stack
│   ├── Login
│   ├── Register
│   └── ForgotPassword
└── Main Navigator (Bottom Tabs)
    ├── Marketplace Stack
    ├── Wallet Stack
    ├── DEX Stack
    ├── Chat Stack
    └── Profile Stack
```

## API Layer

### REST API Client
- Axios-based HTTP client
- Request/response interceptors
- Automatic token refresh
- Offline request queueing

### WebSocket Integration
- Real-time updates for chat and trading
- Automatic reconnection
- Message queueing during disconnection

## Security

### Authentication
- JWT-based authentication
- Biometric authentication (Face ID, Touch ID, Fingerprint)
- Secure storage for credentials

### Data Protection
- Certificate pinning
- Request signing
- Encrypted local storage
- Jailbreak/root detection

## Performance

### Optimization Strategies
- Code splitting and lazy loading
- Image optimization and caching
- Memory management
- Smooth animations (60 FPS)

### Monitoring
- Performance metrics tracking
- Crash reporting
- User analytics

## Testing

### Testing Pyramid
- Unit tests for business logic
- Integration tests for API integration
- E2E tests for critical user flows

### Testing Tools
- Jest for unit testing
- React Native Testing Library for component testing
- Detox for E2E testing

This architecture ensures scalability, maintainability, and performance while providing a great user experience.