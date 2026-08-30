import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Colors from '@/constants/colors';
import { GymProvider } from '@/context/GymContext';
import { RutinaProvider } from '@/context/RutinaContext';
import { trpc, trpcClient } from '@/lib/trpc';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Catches any render/startup error and shows a recovery screen instead of
// letting the app hard-crash back to the home screen (production builds).
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Ups, algo salió mal</Text>
      <Text style={styles.errorText} numberOfLines={4}>
        {error.message}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={retry} activeOpacity={0.8}>
        <Text style={styles.retryText}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
  },
  errorTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  errorText: {
    fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 12, marginTop: 8,
  },
  retryText: { fontSize: 15, fontWeight: '700' as const, color: Colors.black },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Volver' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="book" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <GymProvider>
            <RutinaProvider>
              <RootLayoutNav />
            </RutinaProvider>
          </GymProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
