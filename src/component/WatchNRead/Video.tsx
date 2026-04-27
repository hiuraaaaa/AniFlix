import { Dropdown, IDropdownRef } from '@pirles/react-native-element-dropdown';
import Icon from '@react-native-vector-icons/fontawesome';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { useFocusEffect } from '@react-navigation/core';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import cheerio from 'cheerio';
import { VideoView } from 'expo-video';
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, ScrollView, Text, ToastAndroid, useColorScheme, View } from 'react-native';
import Orientation from 'react-native-orientation-locker';
import { Button, Chip, useTheme } from 'react-native-paper';
import ReAnimated, { useAnimatedRef } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import url from 'url';

import { TouchableOpacity } from '@component/misc/TouchableOpacityRNGH';

import useGlobalStyles, { darkText, lightText } from '@assets/style';
import useDownloadAnimeFunction from '@utils/downloadAnime';
import setHistory from '@utils/historyControl';

import { AniDetail } from '@/types/anime';
import { RootStackNavigator } from '@/types/navigation';
import Skeleton from '@component/misc/Skeleton';
import VideoPlayer, { PlayerRef } from '@component/VideoPlayer';
import { useBackHandler } from '@hooks/useBackHandler';
import AnimeAPI from '@utils/AnimeAPI';
import { useKeyValueIfFocused } from '@utils/DatabaseManager';
import deviceUserAgent from '@utils/deviceUserAgent';
import DialogManager from '@utils/dialogManager';
import {
  getMovieDetail,
  getRawDataIfAvailable,
  getStreamingDetail,
  MovieDetail,
} from '@utils/scrapers/animeMovie';
import { throttle } from '@utils/throttle';
import {
  LoadingModal,
  TimeInfo,
  useBatteryAndClock,
  useFullscreenControl,
  useSynopsisControl,
  useVideoStyles,
} from './SharedVideo';

type Props = NativeStackScreenProps<RootStackNavigator, 'Video'>;

const defaultLoadingGif =
  'https://cdn.dribbble.com/users/2973561/screenshots/5757826/loading__.gif';

function Video(props: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = useTheme();
  const globalStyles = useGlobalStyles();
  const styles = useVideoStyles();

  const enableBatteryTimeInfo = useKeyValueIfFocused('enableBatteryTimeInfo');

  const historyData = useRef(props.route.params.historyData);

  const [showSynopsis, setShowSynopsis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(props.route.params.data);

  const downloadSource = useRef<string[]>([]);
  const currentLink = useRef(props.route.params.link);
  const firstTimeLoad = useRef(true);
  const videoRef = useRef<VideoView>(null);
  const playerRef = useRef<PlayerRef>(null);
  const webviewRef = useRef<WebView>(null);
  const dropdownResolutionRef = useRef<IDropdownRef>(null);
  const embedInformationRef = useRef<View>(null);

  const synopsisTextRef = useAnimatedRef<Text>();

  const [animeDetail, setAnimeDetail] = useState<
    | ((MovieDetail & { status: 'Movie'; releaseYear: string }) | Omit<AniDetail, 'episodeList'>)
    | undefined
  >(undefined);

  useEffect(() => {
    if (props.route.params.isMovie) {
      getMovieDetail(data.episodeData.animeDetail).then(detail => {
        if ('isError' in detail) {
          DialogManager.alert(
            'Error',
            'Inisialisasi data movie gagal! Silahkan buka ulang aplikasi/reload/ketuk teks merah pada beranda untuk mencoba mengambil data yang diperlukan',
          );
          return;
        }
        setAnimeDetail({
          ...detail,
          rating: detail.rating,
          releaseYear: detail.updateDate,
          status: 'Movie',
        });
      });
      return;
    }
    AnimeAPI.fromUrl(data.episodeData.animeDetail, undefined, undefined, true).then(detail => {
      if (detail === 'Unsupported') return;
      if (detail.type === 'animeDetail') {
        if (detail.genres.includes('')) {
          DialogManager.alert(
            'Perhatian!',
            'Anime ini mengandung genre ecchi. Mohon bijak dalam menonton.',
          );
        }
        setAnimeDetail(detail);
      }
    });
  }, [data.episodeData.animeDetail, props.navigation, props.route.params.isMovie]);

  const downloadAnimeFunction = useDownloadAnimeFunction();

  const updateHistory = useMemo(
    () =>
      throttle(
        (
          currentTime: number,
          stateData: RootStackNavigator['Video']['data'],
          isMovie?: boolean,
        ) => {
          if (Math.floor(currentTime) === 0) {
            return;
          }
          const additionalData = {
            resolution: stateData.resolution,
            lastDuration: currentTime,
          };
          setHistory(stateData, currentLink.current, true, additionalData, isMovie);
          historyData.current = additionalData;
        },
        2000,
      ),
    [],
  );

  const abortController = useRef<AbortController | null>(null);

  const [isPaused, setIsPaused] = useState(false);

  const { fullscreen, enterFullscreen, exitFullscreen, orientationDidChange, willUnmountHandler } =
    useFullscreenControl(() => dropdownResolutionRef.current?.close());

  const { batteryLevel, batteryTimeEnable, BatteryIcon } = useBatteryAndClock(
    enableBatteryTimeInfo as string,
  );

  const {
    synopsisTextLength,
    hadSynopsisMeasured,
    infoContainerStyle,
    measureAndUpdateSynopsisLayout,
    onSynopsisPress,
    onSynopsisPressIn,
    onSynopsisPressOut,
  } = useSynopsisControl(synopsisTextRef, showSynopsis, setShowSynopsis);

  useFocusEffect(
    useCallback(() => {
      abortController.current = new AbortController();
      Orientation.addDeviceOrientationListener(orientationDidChange);

      return () => {
        Orientation.removeDeviceOrientationListener(orientationDidChange);
        willUnmountHandler();
        abortController.current?.abort();
      };
    }, [orientationDidChange, willUnmountHandler]),
  );

  useLayoutEffect(() => {
    props.navigation.setOptions({
      headerTitle: data.title,
      headerShown: !fullscreen,
    });
  }, [data, fullscreen, props.navigation]);

  useBackHandler(
    useCallback(() => {
      if (!fullscreen) {
        willUnmountHandler();
        return false;
      } else {
        exitFullscreen();
        return true;
      }
    }, [exitFullscreen, fullscreen, willUnmountHandler]),
  );

  const setResolution = useCallback(
    async (res: string, resolution: string) => {
      if (loading) return;
      setLoading(true);
      let resultData: string | undefined | { canceled: boolean } | { error: boolean };
      const signal = abortController.current?.signal;
      if ('type' in data) {
        resultData = await AnimeAPI.reqResolution(
          res,
          data.reqNonceAction,
          data.reqResolutionWithNonceAction,
          signal,
        ).catch(err => {
          if (err.message === 'canceled') return { canceled: true };
          const errMessage =
            err.message === 'Network Error'
              ? 'Permintaan gagal.\nPastikan kamu terhubung dengan internet'
              : 'Error tidak diketahui: ' + err.message;
          DialogManager.alert('Error', errMessage);
          setLoading(false);
          return { error: true };
        });
      } else {
        const rawData = await getRawDataIfAvailable({ title: resolution, url: res }, signal).catch(
          err => {
            if (err.message === 'canceled') return { canceled: true };
            else throw err;
          },
        );
        if (rawData === false) {
          resultData = cheerio
            .load(Buffer.from(res, 'base64').toString('utf8'))('iframe')
            .attr('src')!;
        } else {
          resultData = rawData;
        }
      }
      if (resultData === undefined) {
        setLoading(false);
        DialogManager.alert('Ganti resolusi gagal', 'Gagal mengganti resolusi karena data kosong!');
        return;
      }
      if (typeof resultData !== 'string' && ('canceled' in resultData || 'error' in resultData)) {
        return;
      }
      const isWebviewNeeded = await fetch(resultData, {
        headers: {
          'User-Agent': deviceUserAgent,
          ...(resultData.includes('mp4upload') ? { Referer: 'https://www.mp4upload.com/' } : {}),
        },
        method: 'HEAD',
        signal,
      })
        .catch(() => {})
        .then(response => {
          return !(
            response?.headers.get('content-type')?.includes('video') ||
            response?.headers.get('content-type')?.includes('octet-stream') ||
            resultData.includes('filedon')
          );
        });
      if (signal?.aborted) return;
      setData(old => ({
        ...old,
        streamingType: isWebviewNeeded ? 'embed' : 'raw',
        streamingLink: resultData,
        resolution,
      }));
      setLoading(false);
      firstTimeLoad.current = true;
    },
    [data, loading],
  );

  const downloadAnime = useCallback(async () => {
    if (data.streamingType === 'embed') {
      return ToastAndroid.show(
        'Jenis format ini tidak mendukung fitur download',
        ToastAndroid.SHORT,
      );
    }
    const source = data.streamingLink;
    const resolution = data.resolution;
    await downloadAnimeFunction(
      source,
      downloadSource.current,
      data.title,
      resolution ?? '',
      undefined,
      () => {
        downloadSource.current = [...downloadSource.current, source];
        ToastAndroid.show('Sedang mendownload...', ToastAndroid.SHORT);
      },
    );
  }, [data, downloadAnimeFunction]);

  const handleProgress = useCallback(
    (currentTime: number) => {
      updateHistory(currentTime, data, props.route.params.isMovie);
    },
    [updateHistory, data, props.route.params.isMovie],
  );

  const episodeDataControl = useCallback(
    async (dataLink: string) => {
      if (loading) return;
      setLoading(true);
      if (props.route.params.isMovie) {
        const result = await getStreamingDetail(dataLink, abortController.current?.signal).catch(
          err => {
            if (err.message === 'canceled') return;
            const errMessage =
              err.message === 'Network Error'
                ? 'Permintaan gagal.\nPastikan kamu terhubung dengan internet'
                : 'Error tidak diketahui: ' + err.message;
            DialogManager.alert('Error', errMessage);
            setLoading(false);
          },
        );
        if (result === undefined) return;
        if ('isError' in result) {
          DialogManager.alert(
            'Error',
            'Inisialisasi data movie gagal! Silahkan buka ulang aplikasi/reload/ketuk teks merah pada beranda untuk mencoba mengambil data yang diperlukan',
          );
        } else {
          setData(result);
          setHistory(result, dataLink, undefined, undefined, props.route.params.isMovie);
        }
      } else {
        const result = await AnimeAPI.fromUrl(
          dataLink,
          undefined,
          undefined,
          undefined,
          abortController.current?.signal,
        ).catch(err => {
          if (err.message === 'Silahkan selesaikan captcha') {
            setLoading(false);
            return;
          }
          if (err.message === 'canceled') return;
          const errMessage =
            err.message === 'Network Error'
              ? 'Permintaan gagal.\nPastikan kamu terhubung dengan internet'
              : 'Error tidak diketahui: ' + err.message;
          DialogManager.alert('Error', errMessage);
          setLoading(false);
        });
        if (result === undefined) return;
        if (result === 'Unsupported') {
          DialogManager.alert('Tidak didukung!', 'Anime yang kamu tuju tidak memiliki data yang didukung!');
          setLoading(false);
          return;
        }
        if (result.type !== 'animeStreaming') {
          setLoading(false);
          DialogManager.alert('Kesalahan!!', 'Hasil perminataan tampaknya bukan data yang diharapkan.');
          return;
        }
        setData(result);
        setHistory(result, dataLink, undefined, undefined);
      }
      setLoading(false);
      firstTimeLoad.current = false;
      historyData.current = undefined;
      currentLink.current = dataLink;
    },
    [loading, props.route.params.isMovie],
  );

  const cancelLoading = useCallback(() => {
    abortController.current?.abort();
    setLoading(false);
    abortController.current = new AbortController();
  }, []);

  const handleVideoLoad = useCallback(() => {
    if (firstTimeLoad.current === false) return;
    firstTimeLoad.current = false;
    if (historyData.current === undefined || historyData.current.lastDuration === undefined) return;
    if (videoRef.current && videoRef.current.props.player) {
      playerRef.current?.skipTo(historyData.current.lastDuration);
    }
    ToastAndroid.show('Otomatis kembali ke durasi terakhir', ToastAndroid.SHORT);
  }, []);

  useEffect(() => {
    if (isPaused) {
      videoRef.current?.props.player.pause();
    } else {
      videoRef.current?.props.player.play();
    }
  }, [isPaused]);

  const fullscreenUpdate = useCallback(
    (isFullscreen: boolean) => {
      if (isFullscreen) exitFullscreen();
      else enterFullscreen();
    },
    [enterFullscreen, exitFullscreen],
  );

  const initialRender = useRef(true);
  useFocusEffect(
    useCallback(() => {
      fullscreen;
      if (initialRender.current) {
        initialRender.current = false;
        return;
      }
      const mightBeTimeoutID = measureAndUpdateSynopsisLayout(true);
      return () => { clearTimeout(mightBeTimeoutID); };
    }, [fullscreen, measureAndUpdateSynopsisLayout]),
  );
  useLayoutEffect(() => {
    measureAndUpdateSynopsisLayout();
  }, [
    animeDetail?.synopsis,
    animeDetail?.rating,
    animeDetail?.genres,
    measureAndUpdateSynopsisLayout,
  ]);

  const batteryAndClock = (
    <>
      {fullscreen && batteryTimeEnable && (
        <View style={[styles.batteryInfo]} pointerEvents="none">
          <BatteryIcon />
          <Text style={{ color: darkText }}> {Math.round(batteryLevel * 100)}%</Text>
        </View>
      )}
      {fullscreen && batteryTimeEnable && (
        <View style={[styles.timeInfo]} pointerEvents="none">
          <TimeInfo />
        </View>
      )}
    </>
  );

  const resolutionDropdownData = useMemo(() => {
    return Object.entries(data.resolutionRaw)
      .filter(z => z[1] !== undefined)
      .map(z => ({ label: z[1].resolution, value: z[1] }));
  }, [data.resolutionRaw]);

  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <LoadingModal setIsPaused={setIsPaused} isLoading={loading} cancelLoading={cancelLoading} />

      {/* VIDEO ELEMENT */}
      <View style={[fullscreen ? styles.fullscreen : styles.notFullscreen]}>
        <View style={{ width: '100%', height: '100%', backgroundColor: 'black', zIndex: 0, position: 'absolute' }} />
        {data.streamingType === 'raw' ? (
          <VideoPlayer
            title={data.title}
            thumbnailURL={data.thumbnailUrl}
            streamingURL={data.streamingLink}
            style={{ flex: 1, zIndex: 1 }}
            videoRef={videoRef}
            ref={playerRef}
            fullscreen={fullscreen}
            onFullscreenUpdate={fullscreenUpdate}
            onDurationChange={handleProgress}
            onLoad={handleVideoLoad}
            headers={
              props.route.params.isMovie && data.streamingLink.includes('mp4upload')
                ? { Referer: 'https://www.mp4upload.com/' }
                : undefined
            }
            batteryAndClock={batteryAndClock}
          />
        ) : data.streamingType === 'embed' ? (
          <WebView
            style={{ flex: 1, zIndex: 1 }}
            ref={webviewRef}
            key={data.streamingLink}
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={navigator => {
              const res =
                navigator.url.includes(url.parse(data.streamingLink).host as string) ||
                navigator.url.includes(defaultLoadingGif);
              if (!res) webviewRef.current?.stopLoading();
              return res;
            }}
            source={{
              ...(data.resolution?.includes('lokal')
                ? {
                    html: `<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body><iframe src="${data.streamingLink}" style="width: 100vw; height: 100vh;" allowFullScreen></iframe></body>`,
                  }
                : { uri: data.streamingLink }),
              baseUrl: `https://${url.parse(data.streamingLink).host}`,
            }}
            userAgent={data.resolution?.includes('lokal') ? undefined : deviceUserAgent}
            originWhitelist={['*']}
            allowsFullscreenVideo={true}
            injectedJavaScript={`
              window.alert = function() {};
              window.confirm = function() {};
              window.prompt = function() {};
              window.open = function() {};
            `}
          />
        ) : (
          <Text style={{ color: 'white' }}>Video tidak tersedia</Text>
        )}
        {data.streamingType === 'embed' && batteryAndClock}
      </View>
      {/* END VIDEO ELEMENT */}

      <ScrollView
        style={{ flex: 1, display: fullscreen ? 'none' : 'flex' }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>

        {/* Warning banners */}
        {props.route.params.isMovie && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: theme.colors.secondaryContainer,
            paddingHorizontal: 14,
            paddingVertical: 10,
            margin: 10,
            borderRadius: 10,
          }}>
            <Icon name="film" color={theme.colors.onSecondaryContainer} size={18} />
            <Text style={{ color: theme.colors.onSecondaryContainer, fontSize: 13, flex: 1 }}>
              Jika ada masalah menonton, coba ganti resolusi/server.
            </Text>
          </View>
        )}

        {(data.resolution?.includes('acefile') || data.resolution?.includes('video')) &&
          data.streamingType === 'embed' && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            backgroundColor: theme.colors.tertiaryContainer,
            paddingHorizontal: 14,
            paddingVertical: 10,
            margin: 10,
            borderRadius: 10,
          }}>
            <Icon name="server" color={theme.colors.onTertiaryContainer} size={18} />
            <Text style={{ color: theme.colors.onTertiaryContainer, fontSize: 13, flex: 1 }}>
              Server AceFile mungkin sedang memproses data. Coba lagi atau ganti server/resolusi.
            </Text>
          </View>
        )}

        {data.streamingType === 'embed' && (
          <View ref={embedInformationRef}>
            <View style={{
              backgroundColor: theme.colors.tertiaryContainer,
              marginHorizontal: 10,
              marginTop: 10,
              borderRadius: 10,
              padding: 12,
              gap: 6,
            }}>
              <TouchableOpacity
                style={{ alignSelf: 'flex-end' }}
                onPress={() => embedInformationRef.current?.setNativeProps({ display: 'none' })}>
                <Icon name="times" color={theme.colors.onTertiaryContainer} size={16} />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="lightbulb-o" color={theme.colors.onTertiaryContainer} size={16} />
                <Text style={{ color: theme.colors.onTertiaryContainer, fontWeight: 'bold', fontSize: 13 }}>
                  Video Player Pihak Ketiga
                </Text>
              </View>
              <Text style={{ color: theme.colors.onTertiaryContainer, fontSize: 12, lineHeight: 18 }}>
                Format video tidak tersedia secara langsung. Fitur download, ganti resolusi, dan fullscreen mungkin tidak bekerja. Kamu mungkin melihat iklan.
              </Text>
            </View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: theme.colors.tertiaryContainer,
              marginHorizontal: 10,
              marginTop: 6,
              borderRadius: 10,
              padding: 12,
            }}>
              <MaterialCommunityIcons name="screen-rotation" color={theme.colors.onTertiaryContainer} size={16} />
              <Text style={{ color: theme.colors.onTertiaryContainer, fontSize: 12, flex: 1 }}>
                Miringkan ponsel ke landscape untuk masuk fullscreen.
              </Text>
            </View>
          </View>
        )}

        {data.streamingType === 'embed' && (
          <TouchableOpacity
            style={[styles.reloadPlayer, { margin: 10, borderRadius: 10 }]}
            onPress={async () => {
              if (data.streamingLink === '') return;
              const streamingLink = data.streamingLink;
              setData(datas => ({ ...datas, streamingLink: '' }));
              await new Promise(res => setTimeout(res, 500));
              setData(datas => ({ ...datas, streamingLink }));
            }}>
            <Icon name="refresh" color={theme.colors.onSecondaryContainer} size={14} />
            <Text style={{ color: theme.colors.onSecondaryContainer, fontSize: 13 }}>Reload video player</Text>
          </TouchableOpacity>
        )}

        {/* Info Panel */}
        <Pressable
          style={[styles.container, {
            backgroundColor: isDark ? '#111' : '#fff',
            margin: 10,
            borderRadius: 12,
            padding: 14,
            gap: 10,
          }]}
          onPressIn={onSynopsisPressIn}
          onPressOut={onSynopsisPressOut}
          onPress={onSynopsisPress}
          disabled={synopsisTextLength < 3}>

          <Text style={[globalStyles.text, { fontSize: 16, fontWeight: 'bold', lineHeight: 22 }]}>
            {data.title}
          </Text>

          {/* Status + Rating + Year */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {animeDetail?.status ? (
              <View style={{
                backgroundColor: animeDetail.status === 'Completed' || animeDetail.status === 'Movie' ? '#2e7d32' : '#c62828',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                  {animeDetail.status}
                </Text>
              </View>
            ) : <Skeleton stopOnBlur={false} width={60} height={22} />}

            {animeDetail?.rating ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="star" color="#FFD700" size={12} />
                <Text style={[globalStyles.text, { fontSize: 12 }]}>{animeDetail.rating}</Text>
              </View>
            ) : null}

            {animeDetail?.releaseYear ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="calendar" color={isDark ? '#aaa' : '#777'} size={12} />
                <Text style={{ color: isDark ? '#aaa' : '#777', fontSize: 12 }}>{animeDetail.releaseYear}</Text>
              </View>
            ) : null}
          </View>

          {/* Genres */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {animeDetail === undefined ? (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Skeleton stopOnBlur={false} width={50} height={20} />
                <Skeleton stopOnBlur={false} width={50} height={20} />
                <Skeleton stopOnBlur={false} width={50} height={20} />
              </View>
            ) : (
              animeDetail.genres.map(genre => (
                <Chip key={genre} compact style={{ backgroundColor: isDark ? '#222' : '#eee', height: 26 }} textStyle={{ fontSize: 11 }}>
                  {genre}
                </Chip>
              ))
            )}
          </View>

          {/* Synopsis */}
          {animeDetail !== undefined ? (
            <ReAnimated.Text
              ref={synopsisTextRef}
              style={[globalStyles.text, { fontSize: 13, lineHeight: 20, color: isDark ? '#ccc' : '#555' }, infoContainerStyle]}
              numberOfLines={!showSynopsis && hadSynopsisMeasured ? 2 : undefined}>
              {animeDetail?.synopsis || 'Tidak ada sinopsis'}
            </ReAnimated.Text>
          ) : (
            <Skeleton stopOnBlur={false} width={150} height={20} />
          )}
          {!hadSynopsisMeasured && animeDetail !== undefined && (
            <Skeleton stopOnBlur={false} width={150} height={20} />
          )}

          {synopsisTextLength >= 3 && (
            <View style={{ alignItems: 'center' }}>
              <Icon
                name={showSynopsis ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={isDark ? '#aaa' : '#888'}
              />
            </View>
          )}
        </Pressable>

        {/* Controls Panel */}
        <View style={[styles.container, {
          backgroundColor: isDark ? '#111' : '#fff',
          margin: 10,
          marginTop: 0,
          borderRadius: 12,
          padding: 14,
          gap: 12,
        }]}>
          {/* Prev / Next Episode */}
          {data.episodeData && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                mode="contained-tonal"
                icon="arrow-left"
                key="prev"
                disabled={!data.episodeData.previous}
                style={{ flex: 1, borderRadius: 10 }}
                onPress={async () => {
                  await episodeDataControl(data.episodeData?.previous as string);
                }}>
                Sebelumnya
              </Button>
              <Button
                mode="contained-tonal"
                icon="arrow-right"
                key="next"
                disabled={!data.episodeData.next}
                style={{ flex: 1, borderRadius: 10 }}
                contentStyle={{ flexDirection: 'row-reverse' }}
                onPress={async () => {
                  await episodeDataControl(data.episodeData?.next as string);
                }}>
                Selanjutnya
              </Button>
            </View>
          )}

          {/* Resolution Dropdown */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="film" size={14} color={isDark ? '#aaa' : '#666'} />
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => dropdownResolutionRef.current?.open()}>
              <View pointerEvents="box-only">
                <Dropdown
                  ref={dropdownResolutionRef}
                  value={{
                    label: data.resolution,
                    value: data.resolutionRaw?.[
                      data.resolutionRaw.findIndex(e => e.resolution === data.resolution)
                    ],
                  }}
                  placeholder="Pilih resolusi"
                  data={resolutionDropdownData}
                  valueField="value"
                  labelField="label"
                  onChange={async val => {
                    await setResolution(val.value.dataContent, val.label);
                  }}
                  style={[styles.dropdownStyle, {
                    backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isDark ? '#333' : '#ddd',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }]}
                  containerStyle={styles.dropdownContainerStyle}
                  itemTextStyle={styles.dropdownItemTextStyle}
                  itemContainerStyle={styles.dropdownItemContainerStyle}
                  activeColor="#16687c"
                  selectedTextStyle={styles.dropdownSelectedTextStyle}
                  placeholderStyle={{ color: globalStyles.text.color }}
                  autoScroll
                  dropdownPosition="top"
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Warnings */}
          {data.resolution?.includes('pogo') && (
            <View style={{
              backgroundColor: isDark ? '#2a1a00' : '#fff3e0',
              borderRadius: 8,
              padding: 10,
              flexDirection: 'row',
              gap: 8,
              alignItems: 'flex-start',
            }}>
              <Icon name="exclamation-triangle" color="#ff6600" size={14} style={{ marginTop: 2 }} />
              <Text style={{ color: '#ff6600', fontSize: 12, flex: 1, lineHeight: 18 }}>
                Server pogo! aktif — hindari skip/seek karena dapat menyebabkan loading lama dan pemborosan kuota. Disarankan download dulu.
              </Text>
            </View>
          )}

          {data.resolution?.includes('lokal') && (
            <View style={{
              backgroundColor: isDark ? '#2a1a00' : '#fff3e0',
              borderRadius: 8,
              padding: 10,
              flexDirection: 'row',
              gap: 8,
              alignItems: 'flex-start',
            }}>
              <Icon name="exclamation-triangle" color="#ff6600" size={14} style={{ marginTop: 2 }} />
              <Text style={{ color: '#ff6600', fontSize: 12, flex: 1, lineHeight: 18 }}>
                Server lokal aktif — download dan lanjut histori tidak tersedia. Gunakan sebagai alternatif terakhir.
              </Text>
            </View>
          )}

          {/* Download Button */}
          <Button
            mode="contained"
            icon="download"
            style={{ borderRadius: 10 }}
            onPress={downloadAnime}>
            Download
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
export default memo(Video);
