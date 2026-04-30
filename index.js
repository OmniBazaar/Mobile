/**
 * Mobile entry point. Registers the root component with `AppRegistry`
 * so React Native's native bridge can find it. Replaces the default
 * Expo `node_modules/expo/AppEntry.js` indirection because npm-workspace
 * hoisting moves `expo/` out of `Mobile/node_modules/` and breaks the
 * relative-path resolution that `@expo/config`'s `resolveEntryPoint`
 * uses at gradle-build time.
 */

import 'expo/build/Expo.fx';
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
