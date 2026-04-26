import MaterialIcon from '@react-native-vector-icons/material-design-icons';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Updates from 'expo-updates';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  ToastAndroid,
  useColorScheme,
  View,
} from 'react-native';
import RNFetchBlob from 'react-native-blob-util';
import Orientation from 'react-native-orientation-locker';
import { useTheme } from 'react-native-paper';
import {
  default as Reanimated,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { EpisodeBaruHome } from '@/types/anime';
import { SetDatabaseTarget } from '@/types/databaseTarget';
import { RootStackNavigator } from '@/types/navigation';
import runningText from '@assets/runningText.json';
import defaultDatabase from '@misc/defaultDatabaseValue.json';
import { version as appVersion, OTAJSVersion } from '@root/package.json';
import AnimeAPI from '@utils/AnimeAPI';
import { DANGER_MIGRATE_OLD_HISTORY, DatabaseManager } from '@utils/DatabaseManager';
import deviceUserAgent from '@utils/deviceUserAgent';
import { AnimeMovieWebView } from '@utils/scrapers/animeMovie';
import { fetchLatestDomain } from '@utils/scrapers/animeSeries';

type Props = NativeStackScreenProps<RootStackNavigator, 'connectToServer'>;

function Loading(props: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    Orientation.lockToPortrait();
  }, []);

  const [loadStatus, setLoadStatus] = useState({
    'Menyiapkan database': false,
    'Mengecek versi aplikasi': false,
    'Mendapatkan domain terbaru': false,
    'Menyiapkan data anime movie': false,
    'Menyiapkan data anime series': false,
  });

  const [isAnimeMovieWebViewOpen, setIsAnimeMovieWebViewOpen] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const progressValueAnimation = useSharedValue(0);

  const fetchAnimeData = useCallback(async (signal: AbortSignal) => {
    const jsondata: EpisodeBaruHome | void = await AnimeAPI.home(signal).catch(() => {
      ToastAndroid.show('Gagal menyiapkan data anime series', ToastAndroid.SHORT);
    });
    setLoadStatus(old => ({ ...old, 'Menyiapkan data anime series': true }));
    if (jsondata === undefined) return { newAnime: [], jadwalAnime: [] };
    return jsondata;
  }, []);

  const prepareData = useCallback(async () => {
    const arrOfDefaultData = Object.keys(defaultDatabase) as SetDatabaseTarget[];
    const allKeys = await DatabaseManager.getAllKeys();
    for (const dataKey of arrOfDefaultData) {
      const data = await DatabaseManager.get(dataKey);
      if (data === null || data === undefined) {
        await DatabaseManager.set(dataKey, defaultDatabase[dataKey]);
        continue;
      }
    }
    const history = await DatabaseManager.get('history');
    if (history) {
      ToastAndroid.show('Mengoptimalkan data history...', ToastAndroid.SHORT);
      await DANGER_MIGRATE_OLD_HISTORY(JSON.parse(history));
    }
    const isInDatabase = (key: string): key is SetDatabaseTarget => {
      return (arrOfDefaultData as readonly string[]).includes(key);
    };
    for (const dataKey of allKeys) {
      if (
        !isInDatabase(dataKey) &&
        !dataKey.startsWith('IGNORE_DEFAULT_DB_') &&
        !dataKey.startsWith('historyItem:')
      ) {
        DatabaseManager.delete(dataKey);
      }
    }
  }, []);

  const deleteUnnecessaryUpdate = useCallback(async () => {
    const downloadPath = `${RNFetchBlob.fs.dirs.DownloadDir}/Lunar-${appVersion}.apk`;
    const isExist = await RNFetchBlob.fs.exists(downloadPath);
    if (isExist) {
      await RNFetchBlob.fs.unlink(downloadPath);
      ToastAndroid.show('Menghapus update tidak terpakai', ToastAndroid.SHORT);
    }
  }, []);

  const fetchDomain = useCallback(async (signal: AbortSignal) => {
    await fetchLatestDomain(signal).catch(() => {
      ToastAndroid.show('Gagal mendapatkan domain terbaru, menggunakan domain default', ToastAndroid.SHORT);
    });
  }, []);

  const checkNativeAppVersion = useCallback(async (signal: AbortSignal) => {
    const abort = new AbortController();
    const timoeut = setTimeout(() => abort.abort(), 5000);
    const onAbort = () => abort.abort();
    signal.addEventListener('abort', onAbort);
    const data = await fetch(
      'https://api.github.com/repos/FightFarewellFearless/AniFlix/releases?per_page=1',
      { signal: abort.signal, headers: { 'User-Agent': deviceUserAgent } },
    ).then(d => d.json()).catch(() => {});
    clearTimeout(timoeut);
    signal.removeEventListener('abort', onAbort);
    if (signal.aborted) return null;
    if (data === undefined) {
      ToastAndroid.show('Error saat mengecek versi', ToastAndroid.SHORT);
      return true;
    } else if (data[0]?.tag_name === appVersion) {
      return true;
    } else if (data[0] === undefined) {
      ToastAndroid.show('Melewatkan pengecekan versi karna terkena rate limit', ToastAndroid.SHORT);
      return true;
    }
    return data[0];
  }, []);

  const moviePromiseResolve = useRef<(val?: unknown) => void>(null);
  const [animeMoviePromise] = useState(() => new Promise(res => (moviePromiseResolve.current = res)));

  const onAnimeMovieReady = useCallback(() => {
    setLoadStatus(old => ({ ...old, 'Menyiapkan data anime movie': true }));
    setIsAnimeMovieWebViewOpen(false);
    moviePromiseResolve.current?.();
  }, []);

  const connectToServers = useCallback(async (signal: AbortSignal) => {
    setIsAnimeMovieWebViewOpen(true);
    const animeData = await fetchAnimeData(signal);
    Promise.all([animeData, animeMoviePromise]).then(([anime]) => {
      if (signal.aborted) return;
      if (anime === undefined) return;
      props.navigation.dispatch(StackActions.replace('Home', { data: anime }));
    });
  }, [animeMoviePromise, fetchAnimeData, props.navigation]);

  useFocusEffect(
    useCallback(() => {
      const abortController = new AbortController();
      const signal = abortController.signal;
      (async () => {
        setLoadStatus({
          'Menyiapkan database': false,
          'Mengecek versi aplikasi': false,
          'Mendapatkan domain terbaru': false,
          'Menyiapkan data anime movie': false,
          'Menyiapkan data anime series': false,
        });
        await prepareData();
        if (signal.aborted) return;
        await deleteUnnecessaryUpdate();
        if (signal.aborted) return;
        setLoadStatus(old => ({ ...old, 'Menyiapkan database': true }));
        const nativeAppVersion = await checkNativeAppVersion(signal);
        if (signal.aborted) return;
        if (nativeAppVersion === null) {
          props.navigation.dispatch(StackActions.replace('FailedToConnect'));
        } else if (nativeAppVersion === true || __DEV__) {
          let isOTADoneExecuted = false;
          async function OTADone() {
            if (isOTADoneExecuted || signal.aborted) return;
            isOTADoneExecuted = true;
            setLoadStatus(old => ({ ...old, 'Mengecek versi aplikasi': true }));
            await fetchDomain(signal);
            if (signal.aborted) return;
            setLoadStatus(old => ({ ...old, 'Mendapatkan domain terbaru': true }));
            connectToServers(signal);
          }
          const OTATimeout = setTimeout(() => {
            if (signal.aborted) return;
            ToastAndroid.show('Pengecekan versi dilewati', ToastAndroid.SHORT);
            OTADone();
          }, 6_000);
          const OTAUpdate = await Updates.checkForUpdateAsync()
            .catch(() => {
              if (!signal.aborted) ToastAndroid.show('Gagal mengecek OTA update', ToastAndroid.SHORT);
              return null;
            })
            .finally(() => clearTimeout(OTATimeout));
          if (signal.aborted) return;
          if (OTAUpdate !== null && OTAUpdate.isAvailable) {
            const changelog = await fetch(
              'https://raw.githubusercontent.com/FightFarewellFearless/AniFlix/refs/heads/master/CHANGELOG.md',
              { signal, headers: { 'User-Agent': deviceUserAgent, 'Cache-Control': 'no-cache' } },
            ).then(d => d.text()).catch(() => 'Gagal mendapatkan changelog');
            if (signal.aborted) return;
            props.navigation.dispatch(StackActions.replace('NeedUpdate', { changelog, size: 0, nativeUpdate: false }));
            return;
          }
          await OTADone();
        } else {
          const latestVersion = nativeAppVersion.tag_name;
          const changelog = nativeAppVersion.body;
          const download = nativeAppVersion.assets[0].browser_download_url;
          props.navigation.dispatch(StackActions.replace('NeedUpdate', { latestVersion, changelog, download, nativeUpdate: true }));
        }
      })();
      return () => { abortController.abort(); };
    }, [prepareData, checkNativeAppVersion, props.navigation, deleteUnnecessaryUpdate, fetchDomain, connectToServers]),
  );

  useEffect(() => {
    const completedSteps = Object.values(loadStatus).filter(Boolean).length;
    const totalSteps = Object.keys(loadStatus).length;
    const progress = (completedSteps / totalSteps) * 100;
    setProgressValue(progress);
    progressValueAnimation.set(withTiming(progress));
  }, [loadStatus, progressValueAnimation]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressValueAnimation.get()}%`,
  }));

  const quotes = useMemo(
    () => runningText[Math.floor(runningText.length * Math.random())] ?? {},
    [],
  );

  const currentStep = Object.entries(loadStatus).find(([, v]) => !v)?.[0] ?? 'Selesai';

  return (
    <View style={styles.container}>
      {isAnimeMovieWebViewOpen && (
        <Suspense>
          <AnimeMovieWebView
            isWebViewShown={isAnimeMovieWebViewOpen}
            setIsWebViewShown={setIsAnimeMovieWebViewOpen}
            onAnimeMovieReady={onAnimeMovieReady}
          />
        </Suspense>
      )}

      {/* Main content - centered */}
      <View style={styles.main}>
        {/* Header */}
        <Text style={styles.appName}>Lunar</Text>
        <Text style={styles.subtitle}>Anime · Film · Komik</Text>

        <View style={styles.spacer} />

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <Reanimated.View style={[styles.progressFill, progressBarStyle]} />
        </View>
        <Text style={styles.currentStep}>{currentStep}</Text>

        <View style={styles.spacerSmall} />

        {/* Status list */}
        <View style={styles.statusContainer}>
          {Object.entries(loadStatus).map(([key, value]) => (
            <View style={styles.statusItem} key={key}>
              {value ? (
                <MaterialIcon name="check-circle" size={16} color="#4CAF50" />
              ) : (
                <ActivityIndicator size={14} color={theme.colors.primary} />
              )}
              <Text style={[styles.statusText, value && styles.statusTextDone]}>{key}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Footer - quote + version */}
      <View style={styles.footer}>
        <Text style={styles.quoteText} numberOfLines={2}>"{quotes.quote}"</Text>
        <Text style={styles.quoteAuthor}>— {quotes.by}</Text>
        <Text style={styles.versionText}>v{appVersion} · JS_{OTAJSVersion}</Text>
      </View>
    </View>
  );
}

function useStyles() {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: isDark ? '#0f0f0f' : '#f5f5f5',
          paddingHorizontal: 28,
          paddingBottom: 32,
          paddingTop: 60,
          justifyContent: 'space-between',
        },
        main: {
          flex: 1,
          justifyContent: 'center',
        },
        appName: {
          fontSize: 42,
          fontWeight: 'bold',
          color: theme.colors.primary,
          letterSpacing: 3,
          textAlign: 'center',
        },
        subtitle: {
          fontSize: 13,
          color: isDark ? '#666' : '#aaa',
          letterSpacing: 1.5,
          textAlign: 'center',
          marginTop: 4,
        },
        spacer: {
          height: 40,
        },
        spacerSmall: {
          height: 16,
        },
        progressBar: {
          height: 4,
          width: '100%',
          backgroundColor: isDark ? '#222' : '#e0e0e0',
          borderRadius: 2,
          overflow: 'hidden',
        },
        progressFill: {
          height: '100%',
          backgroundColor: theme.colors.primary,
          borderRadius: 2,
        },
        currentStep: {
          fontSize: 12,
          color: theme.colors.primary,
          marginTop: 8,
          textAlign: 'center',
          fontWeight: '500',
        },
        statusContainer: {
          gap: 6,
        },
        statusItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 3,
        },
        statusText: {
          fontSize: 13,
          color: isDark ? '#555' : '#bbb',
        },
        statusTextDone: {
          color: isDark ? '#888' : '#999',
          textDecorationLine: 'line-through',
        },
        footer: {
          alignItems: 'center',
          gap: 3,
        },
        quoteText: {
          fontSize: 11,
          fontStyle: 'italic',
          color: isDark ? '#444' : '#bbb',
          textAlign: 'center',
          lineHeight: 16,
        },
        quoteAuthor: {
          fontSize: 10,
          color: isDark ? '#333' : '#ccc',
          textAlign: 'center',
        },
        versionText: {
          fontSize: 10,
          color: isDark ? '#2a2a2a' : '#ddd',
          marginTop: 6,
        },
      }),
    [isDark, theme.colors.primary],
  );
}

export default Loading;
