import React from 'react';
import AppNavigator from './navigation/AppNavigator';
import { AppProvider } from './context/AppContext';

export default function App() {
  return (
    <AppProvider>
      <AppNavigator />
    </AppProvider>
  );
}