import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { DollarSign, Link, Save, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { formatPrice } from '@/constants/gym';
import { useGym } from '@/context/GymContext';

export default function ConfigScreen() {
  const { pricing, updatePricing } = useGym();

  const [twoDays, setTwoDays] = useState(pricing.twoDays.toString());
  const [threeDays, setThreeDays] = useState(pricing.threeDays.toString());
  const [fourPlusDays, setFourPlusDays] = useState(pricing.fourPlusDays.toString());
  const [mpLink, setMpLink] = useState(pricing.mercadoPagoLink);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTwoDays(pricing.twoDays.toString());
    setThreeDays(pricing.threeDays.toString());
    setFourPlusDays(pricing.fourPlusDays.toString());
    setMpLink(pricing.mercadoPagoLink);
  }, [pricing]);

  const handleSave = async () => {
    const t2 = parseInt(twoDays, 10);
    const t3 = parseInt(threeDays, 10);
    const t4 = parseInt(fourPlusDays, 10);

    if (isNaN(t2) || isNaN(t3) || isNaN(t4)) {
      Alert.alert('Error', 'Los precios deben ser números válidos');
      return;
    }

    await updatePricing({
      twoDays: t2,
      threeDays: t3,
      fourPlusDays: t4,
      mercadoPagoLink: mpLink.trim(),
    });

    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Configuración',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text, fontWeight: '700' as const },
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <DollarSign size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Precios de Cuotas</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Configurá los precios mensuales según la cantidad de días que se anota el alumno.
            </Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>2 días por semana</Text>
              <View style={styles.priceInputWrap}>
                <Text style={styles.currencySign}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={twoDays}
                  onChangeText={setTwoDays}
                  keyboardType="numeric"
                  placeholder="15000"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>3 días por semana</Text>
              <View style={styles.priceInputWrap}>
                <Text style={styles.currencySign}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={threeDays}
                  onChangeText={setThreeDays}
                  keyboardType="numeric"
                  placeholder="20000"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>4+ días por semana</Text>
              <View style={styles.priceInputWrap}>
                <Text style={styles.currencySign}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={fourPlusDays}
                  onChangeText={setFourPlusDays}
                  keyboardType="numeric"
                  placeholder="25000"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Link size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Mercado Pago</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Pegá tu link de pago de Mercado Pago. Los alumnos podrán pagar desde la app.
            </Text>

            <TextInput
              style={styles.linkInput}
              value={mpLink}
              onChangeText={setMpLink}
              placeholder="https://mpago.la/..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saved && styles.saveButtonSaved]}
            onPress={handleSave}
            activeOpacity={0.7}
          >
            {saved ? (
              <>
                <CheckCircle size={18} color={Colors.black} />
                <Text style={styles.saveButtonText}>Guardado</Text>
              </>
            ) : (
              <>
                <Save size={18} color={Colors.black} />
                <Text style={styles.saveButtonText}>Guardar cambios</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Vista previa de precios</Text>
            <View style={styles.previewCard}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>2 días</Text>
                <Text style={styles.previewPrice}>
                  {formatPrice(parseInt(twoDays, 10) || 0)}
                </Text>
              </View>
              <View style={styles.previewDivider} />
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>3 días</Text>
                <Text style={styles.previewPrice}>
                  {formatPrice(parseInt(threeDays, 10) || 0)}
                </Text>
              </View>
              <View style={styles.previewDivider} />
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>4+ días</Text>
                <Text style={styles.previewPrice}>
                  {formatPrice(parseInt(fourPlusDays, 10) || 0)}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  sectionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
    flex: 1,
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    width: 140,
  },
  currencySign: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'right' as const,
  },
  linkInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  saveButtonSaved: {
    backgroundColor: Colors.success,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.black,
  },
  previewSection: {
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  previewPrice: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  previewDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
