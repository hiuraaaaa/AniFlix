import useGlobalStyles from '@assets/style';
import { Suspense } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import LoadingIndicator from '@component/misc/LoadingIndicator';

function Loading() {
  const globalStyles = useGlobalStyles();
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: theme.colors.elevation.level2 }]}>
        <LoadingIndicator size={12} />
        <Text style={[globalStyles.text, styles.text]}>Memuat halaman...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.7,
  },
});

export default function SuspenseLoading({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
