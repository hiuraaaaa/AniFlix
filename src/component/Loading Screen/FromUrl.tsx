import { StackActions, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, ToastAndroid, useColorScheme, View } from 'react-native';

import { RootStackNavigator } from '@/types/navigation';
import watchLaterJSON from '@/types/watchLaterJSON';
import runningTextArray from '@assets/runningText.json';
import useGlobalStyles from '@assets/style';
import AnimeAPI from '@utils/AnimeAPI';
import setHistory from '@utils/historyControl';
import controlWatchLater from '@utils/watchLaterControl';

import LoadingIndicator from '@component/misc/LoadingIndicator';
import { DatabaseManager } from '@utils/DatabaseManager';
import DialogManager from '@utils/dialogManager';
import { generateUrlWithLatestDomain } from '@utils/domainChanger';
import { replaceLast } from '@utils/replaceLast';
import { getMovieDetail, getStreamingDetail } from '@utils/scrapers/animeMovie';
import { ComicsDetail, getComicsDetailFromUrl, getComicsReading } from '@utils/scrapers/comicsv2';
import { getFilmDetails, HashProgressData } from '@utils/scrapers/film';
import { getKomikuDetailFromUrl, getKomikuReading, KomikuDetail } from '@utils/scrapers/komiku';
import { setFilmStreamHistory } from '@utils/setFilmStreamHistory';
import { Button, useTheme } from 'react-native-paper';
import URL from 'url';

type Props = NativeStackScreenProps<RootStackNavigator, 'FromUrl'>;

function FromUrl(props: Props) {
  const globalStyles = useGlobalStyles();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = useStyles();

  const [hashProgress, setHashProgress] = useState<HashProgressData | null>(null);
  const speedUpRef = useRef<(() => void) | null>(null);

  const onProgressUpdate = useCallback((data: HashProgressData, trigger?: () => void) => {
    setHashProgress(data);
    if (trigger) speedUpRef.current = trigger;
  }, []);

  const randomQuote = useRef(
    runningTextArray[~~(Math.random() * runningTextArray.length)] ?? {},
  ).current;

  const handleError = useCallback(
    (err: Error) => {
      if (err.message === 'Silahkan selesaikan captcha') {
        props.navigation.goBack();
        return;
      }
      if (err.message === 'canceled' || err.message === 'Aborted') return;
      const errMessage =
        err.message === 'Network Error' || err.message === 'Network request failed'
          ? 'Permintaan gagal: Jaringan Error\nPastikan kamu terhubung dengan internet'
          : 'Error tidak diketahui: ' + err.message;
      DialogManager.alert('Error', errMessage);
      props.navigation.goBack();
    },
    [props.navigation],
  );

  useFocusEffect(
    useCallback(() => {
      props.navigation.setOptions({ headerTitle: props.route.params.title });
      const abort: AbortController = new AbortController();
      let link: string;
      try {
        link = generateUrlWithLatestDomain(props.route.params.link);
      } catch {
        link = props.route.params.link;
      }
      if (link === undefined) {
        props.navigation.goBack();
        DialogManager.alert(
          'Error',
          'Link tidak ditemukan!\nMohon informasikan hal ini ke server discord kami ' +
            '(dapat ditemukan di beranda aplikasi). ' +
            'Lengkap dengan judul anime/film/komik yang kamu cari.',
        );
        return;
      }
      const resolution = props.route.params.historyData?.resolution;
      if (link.includes('nanimex')) {
        props.navigation.goBack();
        DialogManager.alert(
          'Perhatian!',
          'Dikarenakan data yang digunakan berbeda, history lama tidak didukung, sehingga sebagai solusi, kamu harus mencari anime ini secara manual di menu pencarian dan pilih episode yang sesuai.',
        );
        return;
      }
      if (props.route.params.type === 'movie') {
        if (URL.parse(link)?.pathname?.split('/')[1] === 'anime') {
          getMovieDetail(link, abort.signal)
            .then(result => {
              if (abort.signal.aborted || props.navigation.getState().routes.length === 1) return;
              if ('isError' in result) {
                DialogManager.alert('Error', 'Inisialisasi data movie gagal! Silahkan buka ulang aplikasi/reload/ketuk teks merah pada beranda untuk mencoba mengambil data yang diperlukan');
                props.navigation.goBack();
                return;
              }
              props.navigation.dispatch(StackActions.replace('MovieDetail', { data: result, link }));
            })
            .catch(handleError);
        } else {
          getStreamingDetail(link, abort.signal)
            .then(async result => {
              if (abort.signal.aborted || props.navigation.getState().routes.length === 1) return;
              if ('isError' in result) {
                DialogManager.alert('Error', 'Inisialisasi data movie gagal! Silahkan buka ulang aplikasi/reload/ketuk teks merah pada beranda untuk mencoba mengambil data yang diperlukan');
                props.navigation.goBack();
                return;
              }
              props.navigation.dispatch(StackActions.replace('Video', { data: result, link, historyData: props.route.params.historyData, isMovie: true }));
              setHistory(result, link, false, props.route.params.historyData, props.route.params.type === 'movie');
              const episodeIndex = result.title.toLowerCase().indexOf(' episode');
              const title = episodeIndex >= 0 ? result.title.slice(0, episodeIndex) : result.title;
              const watchLater: watchLaterJSON[] = JSON.parse((await DatabaseManager.get('watchLater'))!);
              const watchLaterIndex = watchLater.findIndex(z => z.title.trim() === title.trim() && z.isMovie === true);
              if (watchLaterIndex >= 0) {
                controlWatchLater('delete', watchLaterIndex);
                ToastAndroid.show(`${title} dihapus dari daftar tonton nanti`, ToastAndroid.SHORT);
              }
            })
            .catch(handleError);
        }
      } else if (props.route.params.type === 'anime' || props.route.params.type === undefined) {
        AnimeAPI.fromUrl(link, resolution, !!resolution, undefined, abort.signal)
          .then(async result => {
            if (result === 'Unsupported') {
              DialogManager.alert('Tidak didukung!', 'Anime yang kamu tuju tidak memiliki data yang didukung!');
              props.navigation.goBack();
              return;
            }
            try {
              if (result.type === 'animeDetail') {
                if (result.genres.includes('')) {
                  DialogManager.alert('Perhatian!', 'Anime ini mengandung genre ecchi. Mohon bijak dalam menonton.');
                }
                if (abort.signal.aborted || props.navigation.getState().routes.length === 1) return;
                props.navigation.dispatch(StackActions.replace('AnimeDetail', { data: result, link }));
              } else if (result.type === 'animeStreaming') {
                if (abort.signal.aborted || props.navigation.getState().routes.length === 1) return;
                props.navigation.dispatch(StackActions.replace('Video', { data: result, link, historyData: props.route.params.historyData }));
                setHistory(result, link, false, props.route.params.historyData);
                const episodeIndex = result.title.toLowerCase().indexOf(' episode');
                const title = episodeIndex >= 0 ? result.title.slice(0, episodeIndex) : result.title;
                const watchLater: watchLaterJSON[] = JSON.parse((await DatabaseManager.get('watchLater'))!);
                const normalizeWatchLaterTitle = (str: string) => {
                  let resultString = str.split('(Episode')[0].trim();
                  if (resultString.endsWith('BD')) return replaceLast(resultString, 'BD', '');
                  return resultString;
                };
                const watchLaterIndex = watchLater.findIndex(z => (z.link === result.episodeData.animeDetail || normalizeWatchLaterTitle(z.title.trim()) === title.trim()) && !z.isMovie && !z.isComics);
                if (watchLaterIndex >= 0) {
                  controlWatchLater('delete', watchLaterIndex);
                  ToastAndroid.show(`${title} dihapus dari daftar tonton nanti`, ToastAndroid.SHORT);
                }
              }
            } catch (e: any) {
              DialogManager.alert('Error', e.message);
              props.navigation.goBack();
            }
          })
          .catch(handleError);
      } else if (props.route.params.type === 'film') {
        if (props.route.params.link.includes('tv12.idlix')) {
          props.navigation.goBack();
          DialogManager.alert('Perhatian!', 'Dikarenakan perubahan terkait data film, history film lama tidak didukung, sehingga sebagai solusi, kamu harus mencari film ini secara manual di menu pencarian dan pilih episode yang sesuai.');
          return;
        }
        getFilmDetails(link, abort.signal, onProgressUpdate)
          .then(async data => {
            if (abort.signal.aborted || props.navigation.getState().routes.length === 1) return;
            if (data.type === 'detail') {
              props.navigation.dispatch(StackActions.replace('FilmDetail', { data, link }));
            } else if (data.type === 'stream' && (props.route.params.historyData || props.navigation.getState().routes.find(z => z.name === 'FilmDetail'))) {
              props.navigation.dispatch(StackActions.replace('Video_Film', { data, link, historyData: props.route.params.historyData }));
              await setFilmStreamHistory(link, data, props.route.params.historyData);
            } else {
              props.navigation.dispatch(StackActions.replace('FilmDetail', { data, link }));
            }
          })
          .catch(handleError);
      } else {
        const isKomiku = link.includes('komiku');
        const isKomikindo = link.includes('komikindo');
        const isSoftkomik = link.includes('softkomik');
        const isSoftkomikGoToDetail = isSoftkomik && !link.includes('/chapter/');
        const isKomikuGoToDetail = isKomiku && link.includes('/manga/');
        const isKomikindoGoToDetail = isKomikindo && !(link.includes('-chapter-') || link.includes('-chapte-'));
        const goToDetail = isKomikuGoToDetail || isKomikindoGoToDetail || isSoftkomikGoToDetail;
        if (goToDetail) {
          const fetchComicsPromise = (link.includes('komikindo') || link.includes('softkomik') ? getComicsDetailFromUrl(link, abort.signal) : getKomikuDetailFromUrl(link, abort.signal)) as Promise<ComicsDetail | KomikuDetail>;
          fetchComicsPromise
            .then(result => {
              if (abort.signal.aborted || props.navigation.getState().routes.length === 1) return;
              if (result.genres.includes('Ecchi')) {
                DialogManager.alert('Perhatian!', 'Komik ini mengandung genre ecchi. Mohon bijak dalam membaca.');
              }
              props.navigation.dispatch(StackActions.replace('ComicsDetail', { data: result, link }));
            })
            .catch(handleError);
        } else {
          (link.includes('komikindo') || link.includes('softkomik') ? getComicsReading : getKomikuReading)(link, abort.signal)
            .then(async result => {
              if (abort.signal.aborted || props.navigation.getState().routes.length === 1) return;
              props.navigation.dispatch(StackActions.replace('ComicsReading', { data: result, historyData: props.route.params.historyData, link }));
              setHistory(result, link, false, props.route.params.historyData, false, true);
              const chapterIndex = result.title.toLowerCase().indexOf(' chapter');
              const title = chapterIndex >= 0 ? result.title.slice(0, chapterIndex) : result.title;
              const watchLater: watchLaterJSON[] = JSON.parse((await DatabaseManager.get('watchLater'))!);
              const watchLaterIndex = watchLater.findIndex(z => z.title.trim() === title.trim() && z.isComics === true);
              if (watchLaterIndex >= 0) {
                controlWatchLater('delete', watchLaterIndex);
                ToastAndroid.show(`${title} dihapus dari daftar tonton nanti`, ToastAndroid.SHORT);
              }
            })
            .catch(handleError);
        }
      }
      return () => { abort.abort(); };
    }, [handleError, props.navigation, props.route.params.historyData, props.route.params.title, props.route.params.type, props.route.params.link, onProgressUpdate]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <LoadingIndicator size={15} />

        {hashProgress ? (
          <View style={styles.hashContainer}>
            <Text style={[styles.hashTitle, { color: hashProgress.isCompleted ? '#4CAF50' : globalStyles.text.color }]}>
              {hashProgress.isCompleted ? '✓ Proteksi Berhasil Dipecahkan!' : 'Memecahkan Proteksi Keamanan'}
            </Text>
            <Text style={styles.hashDifficulty}>Tingkat Kesulitan: {hashProgress.difficulty}</Text>

            <View style={[styles.hashTimerBox, {
              borderColor: hashProgress.isCompleted ? '#4CAF50' : 'transparent',
              backgroundColor: hashProgress.isCompleted ? 'rgba(76,175,80,0.1)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }]}>
              <Text style={[styles.hashTimer, { color: hashProgress.isCompleted ? '#4CAF50' : globalStyles.text.color }]}>
                {hashProgress.elapsed} detik
              </Text>
            </View>

            {hashProgress.canSpeedUp && !hashProgress.isSpeedingUp && !hashProgress.isCompleted && (
              <Button onPress={() => speedUpRef.current?.()} style={styles.speedUpButton} mode="contained-tonal">
                Percepat Proses
              </Button>
            )}
            {hashProgress.isSpeedingUp && !hashProgress.isCompleted && (
              <Text style={styles.speedingText}>Mempercepat dengan multi-core...</Text>
            )}
            {!hashProgress.isCompleted ? (
              <>
                <Text style={styles.hashNote}>Proses ini mungkin memakan waktu lama tergantung performa perangkat.</Text>
                <Text style={styles.hashCancel}>Tekan tombol KEMBALI untuk batal.</Text>
              </>
            ) : (
              <Text style={[styles.hashNote, { color: '#4CAF50', fontWeight: 'bold' }]}>Menyiapkan Video...</Text>
            )}
          </View>
        ) : (
          <View style={styles.quoteContainer}>
            <Text style={styles.loadingText}>Mengambil data...</Text>
            <Text style={styles.quoteText} numberOfLines={2}>"{randomQuote.quote}"</Text>
            <Text style={styles.quoteAuthor}>— {randomQuote.by}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function useStyles() {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f0f0f' : '#f5f5f5',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
      gap: 20,
    },
    quoteContainer: {
      width: '100%',
      alignItems: 'center',
      gap: 8,
    },
    loadingText: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#ccc' : '#555',
      marginBottom: 4,
    },
    quoteText: {
      fontSize: 12,
      fontStyle: 'italic',
      color: isDark ? '#444' : '#bbb',
      textAlign: 'center',
      lineHeight: 18,
    },
    quoteAuthor: {
      fontSize: 11,
      color: isDark ? '#333' : '#ccc',
      textAlign: 'center',
    },
    hashContainer: {
      width: '100%',
      alignItems: 'center',
      gap: 12,
    },
    hashTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    hashDifficulty: {
      fontSize: 13,
      color: isDark ? '#aaa' : '#777',
    },
    hashTimerBox: {
      borderWidth: 1,
      paddingVertical: 12,
      paddingHorizontal: 32,
      borderRadius: 12,
    },
    hashTimer: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    speedUpButton: {
      width: '80%',
    },
    speedingText: {
      color: '#4CAF50',
      fontSize: 13,
      fontStyle: 'italic',
    },
    hashNote: {
      textAlign: 'center',
      fontSize: 12,
      color: isDark ? '#aaa' : '#777',
      lineHeight: 18,
    },
    hashCancel: {
      textAlign: 'center',
      fontSize: 12,
      color: '#ef233c',
      fontWeight: 'bold',
    },
  });
}

export default FromUrl;
