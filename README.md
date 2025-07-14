# OmniBazaar Mobile

Native iOS and Android applications for the OmniBazaar decentralized marketplace, wallet, and DEX platform.

## Overview

The OmniBazaar Mobile module provides feature-complete mobile applications that mirror and enhance the functionality of the web browser extension. Built with React Native and Expo, these apps offer a native mobile experience while maximizing code reuse from the web platform.

## Features

### Core Functionality
- **Marketplace**: Browse, search, buy, and sell products with mobile-optimized UI
- **Wallet**: Multi-asset crypto wallet with biometric security
- **DEX**: Decentralized exchange with touch-optimized trading
- **Chat**: Peer-to-peer messaging with push notifications
- **KYC**: Identity verification with native camera integration

### Mobile-Native Enhancements
- 🔐 **Biometric Authentication**: FaceID, TouchID, and fingerprint support
- 📱 **Push Notifications**: Real-time alerts for orders, messages, and transactions
- 📷 **Camera Integration**: Product photos, QR scanning, document capture
- 📍 **Location Services**: Find nearby sellers and location-based offers
- 💳 **Mobile Payments**: NFC tap-to-pay, Apple Pay, Google Pay
- 🔄 **Offline Support**: Browse and transact without constant connectivity
- 📊 **Widgets**: Home screen widgets for prices and balances

## Technology Stack

- **Framework**: React Native 0.73+ with Expo SDK 50+
- **Language**: TypeScript 5.3+
- **State Management**: Redux Toolkit (shared with web)
- **Navigation**: React Navigation 6+
- **Database**: WatermelonDB (offline-first)
- **Testing**: Jest, React Native Testing Library, Detox
- **CI/CD**: GitHub Actions, Expo EAS Build

## Project Structure

```
Mobile/
├── src/                    # Source code
│   ├── components/         # Reusable UI components
│   ├── screens/           # Screen components
│   ├── navigation/        # Navigation configuration
│   ├── services/          # Business logic and API
│   ├── store/            # Redux store and slices
│   ├── native/           # Platform-specific code
│   ├── theme/            # Styling and theming
│   └── utils/            # Utility functions
├── ios/                   # iOS-specific code
├── android/               # Android-specific code
├── assets/                # Images, fonts, etc.
├── __tests__/             # Test files
└── docs/                  # Additional documentation
```

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm** or **yarn**: Latest version
- **React Native CLI**: `npm install -g react-native-cli`
- **Expo CLI**: `npm install -g expo-cli`
- **iOS Development** (Mac only):
  - Xcode 14+
  - iOS Simulator or physical device
- **Android Development**:
  - Android Studio
  - Android SDK (API Level 24+)
  - Android Emulator or physical device

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/omnibazaar/mobile.git
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Install iOS dependencies (Mac only):
   ```bash
   cd ios && pod install && cd ..
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Running the App

#### Development Mode

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on specific device
npm run ios --device "iPhone 14"
npm run android --deviceId "emulator-5554"
```

#### Using Expo Go

```bash
# Start Expo development server
expo start

# Scan QR code with Expo Go app on your device
```

### Building for Production

```bash
# Build iOS app
eas build --platform ios

# Build Android app
eas build --platform android

# Build both platforms
eas build --platform all
```

## Development

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests (Detox)
npm run e2e:ios
npm run e2e:android
```

### Debugging

- **React Native Debugger**: Standalone debugger for React Native
- **Flipper**: Platform for debugging mobile apps
- **Chrome DevTools**: For JavaScript debugging
- **React DevTools**: For component inspection

## Architecture

### State Management

The app uses Redux Toolkit with the following structure:
- **Shared slices**: Imported from web extension
- **Mobile-specific slices**: Navigation, offline queue, device settings
- **Redux Persist**: For offline state persistence

### API Integration

- RESTful API client shared with web extension
- GraphQL subscriptions for real-time updates
- Offline request queueing with background sync

### Navigation Structure

```
Bottom Tabs
├── Marketplace Stack
│   ├── Product List
│   ├── Product Detail
│   └── Cart/Checkout
├── Wallet Stack
│   ├── Balance Overview
│   ├── Asset Detail
│   └── Send/Receive
├── DEX Stack
│   ├── Markets
│   ├── Trading View
│   └── Orders
├── Chat Stack
│   ├── Conversations
│   ├── Messages
│   └── Settings
└── Profile Stack
    ├── Account Info
    ├── Settings
    └── Security
```

## Platform-Specific Features

### iOS
- Apple Wallet integration
- Siri Shortcuts
- 3D Touch/Haptic Touch
- iOS widgets
- App Clips

### Android
- Google Wallet integration
- Assistant Actions
- Material You theming
- Android widgets
- Instant Apps

## Security

- **Biometric Authentication**: For app access and transaction signing
- **Encrypted Storage**: All sensitive data encrypted at rest
- **Certificate Pinning**: Prevents MITM attacks
- **Jailbreak/Root Detection**: Warns users of security risks
- **Secure Communication**: TLS 1.3 with perfect forward secrecy

## Performance

Target metrics:
- App size: <50MB
- Cold start: <2 seconds
- Screen transitions: <100ms
- 60 FPS animations
- <5% battery drain per hour

## Contributing

Please read our [Contributing Guide](../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Development Workflow

1. Create a feature branch from `develop`
2. Make your changes following our coding standards
3. Write/update tests for your changes
4. Ensure all tests pass
5. Submit a pull request to `develop`

## Documentation

- [Mobile Development Plan](./MOBILE_DEVELOPMENT_PLAN.md)
- [Development Status](./DEVELOPMENT_STATUS.md)
- [TODO List](./TODO.md)
- [API Documentation](./docs/API.md)
- [Architecture Guide](./docs/ARCHITECTURE.md)

## Support

- **Bug Reports**: [GitHub Issues](https://github.com/omnibazaar/mobile/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/omnibazaar/mobile/discussions)
- **Security Issues**: security@omnibazaar.com

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- React Native community for the excellent framework
- Expo team for simplifying mobile development
- All contributors who help make OmniBazaar better

---

**Note**: This module is part of the larger OmniBazaar ecosystem. For information about other modules, see the [main repository](https://github.com/omnibazaar/omnibazaar).
