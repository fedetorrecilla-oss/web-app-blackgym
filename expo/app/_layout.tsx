import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Clipboard, Share, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Colors from '@/constants/colors';
import { GymProvider } from '@/context/GymContext';
import { RutinaProvider } from '@/context/RutinaContext';
import { trpc, trpcClient } from '@/lib/trpc';

const queryClient = new QueryClient();

// Archivo donde el handler nativo (std::terminate / NSException) y el parche
// de TurboModule escriben el reporte del último fallo capturado.
const NATIVE_REPORT_FILE = 'blackgym_last_crash.txt';

// Catches any render/startup error and shows a recovery screen instead of
// letting the app hard-crash back to the home screen (production builds).
// Además muestra y permite copiar/compartir el reporte nativo capturado:
// canal de diagnóstico independiente del backend.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const [nativeReport, setNativeReport] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    try {
      const reportFile = new File(Paths.cache, NATIVE_REPORT_FILE);
      if (reportFile.exists) {
        reportFile
          .text()
          .then((content) => {
            if (active && content && content.trim().length > 0) setNativeReport(content);
          })
          .catch(() => {});
      }
    } catch {
      // Sin reporte en disco: la pantalla muestra solo el error de JS.
    }
    return () => {
      active = false;
    };
  }, []);

  const reportText = nativeReport
    ? `${nativeReport}\n\n--- Error de JavaScript ---\n${error.message}`
    : `[Black Gym] ErrorBoundary\nerror: ${error.message}`;

  const copyReport = () => {
    try {
      Clipboard.setString(reportText);
      Alert.alert('Reporte copiado', 'Pegalo en el chat para enviarlo.');
    } catch {
      // Clipboard no disponible: el botón Compartir cubre el mismo caso.
    }
  };

  const shareReport = () => {
    Share.share({ message: reportText }).catch(() => {});
  };

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Ups, algo salió mal</Text>
      <Text style={styles.errorText} numberOfLines={4}>
        {error.message}
      </Text>
      {nativeReport ? (
        <View style={styles.reportBox}>
          <Text style={styles.reportLabel}>Reporte técnico capturado:</Text>
          <Text style={styles.reportText} numberOfLines={6}>
            {nativeReport}
          </Text>
        </View>
      ) : null}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.retryButton} onPress={retry} activeOpacity={0.8}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={copyReport} activeOpacity={0.8}>
          <Text style={styles.secondaryText}>Copiar reporte</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={shareReport} activeOpacity={0.8}>
          <Text style={styles.secondaryText}>Compartir</Text>
        </TouchableOpacity>
      </View>
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
  reportBox: {
    width: '100%', backgroundColor: '#151515', borderRadius: 12,
    padding: 12, gap: 6,
  },
  reportLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.text },
  reportText: {
    fontFamily: 'Menlo', fontSize: 10, color: Colors.textMuted,
  },
  buttonRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 10, marginTop: 8,
  },
  retryButton: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  retryText: { fontSize: 15, fontWeight: '700' as const, color: Colors.black },
  secondaryButton: {
    backgroundColor: Colors.surface ?? '#2A2A2A', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  secondaryText: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
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
    // Deferred to mount: module-scope native calls crash release builds on
    // iOS 26 before the error boundary exists (TurboModule void-method bug).
    SplashScreen.preventAutoHideAsync().catch(() => {});
    SplashScreen.hideAsync().catch(() => {});
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
