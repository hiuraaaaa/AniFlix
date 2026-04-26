import { LegendList, LegendListRef } from '@legendapp/list';
import MaterialIcon, { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  NavigationProp,
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { FlashList, ListRenderItemInfo, useMappingHelper } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import React, {
  memo,
  use,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Image, 
  ScrollView as RNScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  ToastAndroid,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';
import { TouchableOpacity as TouchableOpacityPaper, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EpisodeBaruHome as EpisodeBaruType, JadwalAnime, NewAnimeList } from '@/types/anime';
import { HomeNavigator, RootStackNavigator } from '@/types/navigation';
import useGlobalStyles from '@assets/style';
import Announcment from '@component/misc/Announcement';
import { ListAnimeComponent } from '@component/misc/ListAnimeComponent';
import Skeleton from '@component/misc/Skeleton';
import { TouchableOpacity } from '@component/misc/TouchableOpacityRNGH';
import ImageLoading from '@component/misc/ImageLoading';
import {
  ComicsListContext,
  EpisodeBaruHomeContext,
  FilmListHomeContext,
  MovieListHomeContext,
  SeriesListHomeContext,
} from '@misc/context';
import AnimeAPI from '@utils/AnimeAPI';
import { getLatestMovie, Movies } from '@utils/scrapers/animeMovie';
import { getLatestComicsReleases, LatestComicsRelease } from '@utils/scrapers/comicsv2';
import { FilmHomePage, getHomepage, getLatestMovies, getLatestSeries } from '@utils/scrapers/film';

export const MIN_IMAGE_HEIGHT = 160;
export const MIN_IMAGE_WIDTH = 90;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type HomeProps = BottomTabScreenProps<HomeNavigator, 'AnimeList'>;

const Home = memo(HomeList);
export default Home;

// Banner Carousel dengan blur + smooth transition
function BannerCarousel({ data, navigation }: { data: FilmHomePage; navigation: HomeProps['navigation'] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<RNScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const items = data.slice(0, 8);
  const isScrolling = useRef(false);

  const goToIndex = useCallback((next: number) => {
    if (isScrolling.current) return;
    isScrolling.current = true;

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setActiveIndex(next);
      scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        isScrolling.current = false;
      });
    });
  }, [fadeAnim]);

  useEffect(() => {
    if (items.length === 0) return;
    const interval = setInterval(() => {
      const next = (activeIndex + 1) % items.length;
      goToIndex(next);
    }, 4500);
    return () => clearInterval(interval);
  }, [activeIndex, items.length, goToIndex]);

  if (items.length === 0) return null;

  const currentItem = items[activeIndex];

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ position: 'relative' }}>
        <RNScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            if (idx !== activeIndex) {
              Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
              }).start(() => {
                setActiveIndex(idx);
                Animated.timing(fadeAnim, {
                  toValue: 1,
                  duration: 350,
                  useNativeDriver: true,
                }).start();
              });
            }
          }}
          scrollEventThrottle={16}>
          {items.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={{ width: SCREEN_WIDTH, height: 240 }}
              onPress={() => {
                navigation.dispatch(StackActions.push('FromUrl', { title: item.title, link: item.url, type: 'film' }));
              }}>
              <ImageLoading
                source={{ uri: item.thumbnailUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover">
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.97)']}
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180 }}
                />
              </ImageLoading>
            </TouchableOpacity>
          ))}
        </RNScrollView>

        {/* Overlay info dengan fade animation */}
        <Animated.View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 10,
          opacity: fadeAnim,
        }}>
          {/* Poster kecil */}
          <ImageLoading
            source={{ uri: currentItem?.thumbnailUrl }}
            style={{
              width: 70,
              height: 100,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.25)',
            }}
            resizeMode="cover"
          />

          {/* Info */}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>UNGGULAN</Text>
              </View>
              {'rating' in currentItem && currentItem.rating && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <MaterialIcon name="star" size={12} color="#FFD700" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{currentItem.rating}</Text>
                </View>
              )}
            </View>
            <Text numberOfLines={2} style={{ color: '#fff', fontSize: 15, fontWeight: 'bold', lineHeight: 20 }}>
              {currentItem?.title}
            </Text>
            {'synopsis' in currentItem && currentItem.synopsis ? (
              <Text numberOfLines={2} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 16 }}>
                {currentItem.synopsis}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={() => navigation.dispatch(StackActions.push('FromUrl', { title: currentItem?.title, link: currentItem?.url, type: 'film' }))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: theme.colors.primary,
                alignSelf: 'flex-start',
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 20,
                marginTop: 2,
              }}>
              <MaterialIcon name="play-arrow" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Tonton</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* Dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 }}>
        {items.map((_, i) => (
          <View key={i} style={{
            width: i === activeIndex ? 16 : 6,
            height: 4,
            borderRadius: 2,
            backgroundColor: i === activeIndex ? theme.colors.primary : isDark ? '#444' : '#ccc',
          }} />
        ))}
      </View>
    </View>
  );
}

function HomeList(props: HomeProps) {
  const globalStyles = useGlobalStyles();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { paramsState: data, setParamsState: setData } = useContext(EpisodeBaruHomeContext);
  const [refresh, setRefresh] = useState(false);
  const [refreshingKey, setRefreshingKey] = useState(0);

  // Hapus useFonts di sini — sudah di-load di App.tsx
  // Font Cinzel_700Bold sudah pasti tersedia saat screen ini render

  const refreshing = useCallback(() => {
    setRefresh(true);
    setData?.(val => ({ ...val, newAnime: [] }));
    setRefreshingKey(val => val + 1);
    setTimeout(() => {
      AnimeAPI.home()
        .then(async jsondata => {
          setData?.(jsondata);
          setRefresh(false);
        })
        .catch(() => {
          ToastAndroid.show('Gagal terhubung ke server.', ToastAndroid.SHORT);
          setRefresh(false);
        });
    }, 0);
  }, [setData]);

  const renderJadwalAnime = useCallback(
    ({ item }: { item: keyof JadwalAnime }) => <JadwalComponent item={item} props={props} />,
    [props],
  );

  const listRef = useRef<LegendListRef>(null);
  const [jadwalHidden, setJadwalHidden] = useState(true);
  const toggleJadwal = useCallback(() => setJadwalHidden(x => !x), []);
  useEffect(() => {
    if (!jadwalHidden) {
      listRef.current?.scrollToIndex({ index: 0, animated: true, viewPosition: 0.5 });
    }
  }, [jadwalHidden]);
  const jadwalDataArray = useMemo(
    () => (jadwalHidden ? [] : Object.keys(data?.jadwalAnime ?? {})),
    [data?.jadwalAnime, jadwalHidden],
  );

  const [filmHomepageData, setFilmHomepageData] = useState<Awaited<ReturnType<typeof getHomepage>>>({ featured: [], trending: [] });
  const [isFilmError, setIsFilmError] = useState(false);

  useEffect(() => {
    setFilmHomepageData({ featured: [], trending: [] });
    setIsFilmError(false);
    queueMicrotask(() => {
      getHomepage().then(setFilmHomepageData).catch(() => setIsFilmError(true));
    });
  }, [refreshingKey]);

  return (
    <LegendList
      ref={listRef}
      recycleItems
      renderScrollComponent={RenderScrollComponent}
      style={styles.container}
      refreshControl={
        <RefreshControl
          style={{ zIndex: 1 }}
          refreshing={refresh}
          onRefresh={refreshing}
          progressBackgroundColor={isDark ? '#121212' : '#ffffff'}
          colors={[theme.colors.primary]}
        />
      }
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      ListHeaderComponent={
        <>
          <Announcment />
          {/* Header - langsung pakai Cinzel tanpa cek fontsLoaded */}
          <View style={styles.header}>
           <Image
            source={require('@assets/lunar-logo.png')}
            style={{ height: 42, width: 210 }}
            resizeMode="contain"
            />
           </View>
          {/* Banner Carousel */}
          {filmHomepageData.featured.length > 0 && (
            <BannerCarousel data={filmHomepageData.featured} navigation={props.navigation} />
          )}

          {/* Episode Terbaru */}
          <EpisodeBaru
            isRefreshing={refresh}
            styles={styles}
            globalStyles={globalStyles}
            data={data}
            props={props}
          />

          {/* Film Unggulan */}
          <FeaturedFilmList
            data={filmHomepageData.featured}
            isError={isFilmError}
            props={props}
            key={'film_featured' + refreshingKey}
          />

          <TrendingFilmList
            data={filmHomepageData.trending}
            isError={isFilmError}
            props={props}
            key={'film_trending' + refreshingKey}
          />
          <LatestFilmList props={props} key={'film_latest' + refreshingKey} />
          <LatestSeriesList props={props} key={'series_latest' + refreshingKey} />
          <MovieList props={props} key={'anime_movie' + refreshingKey} />
          <ComicList key={'comick' + refreshingKey} />

          <TouchableOpacity
            onPress={toggleJadwal}
            style={[styles.scheduleSection, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            <Text style={styles.sectionTitle}>JADWAL ANIME</Text>
            <MaterialIcons name={jadwalHidden ? 'arrow-downward' : 'arrow-upward'} size={18} color={styles.sectionTitle.color} />
          </TouchableOpacity>
        </>
      }
      data={jadwalDataArray}
      keyExtractor={z => z?.toString()}
      renderItem={renderJadwalAnime}
      showsVerticalScrollIndicator={false}
    />
  );
}

// Episode Terbaru
const EpisodeBaru = memo(
  EpisodeBaruUNMEMO,
  (prev, next) =>
    prev.data?.newAnime[0]?.title === next.data?.newAnime[0]?.title &&
    prev.isRefreshing === next.isRefreshing &&
    prev.styles === next.styles &&
    prev.globalStyles.text === next.globalStyles.text,
);

function EpisodeBaruUNMEMO({
  styles, data, props, isRefreshing,
}: {
  data: EpisodeBaruType | undefined;
  props: HomeProps;
  isRefreshing?: boolean;
  styles: ReturnType<typeof useStyles>;
  globalStyles: ReturnType<typeof useGlobalStyles>;
}) {
  const dimensions = useWindowDimensions();
  const LIST_W = dimensions.width * 0.32;
  const LIST_H = LIST_W * 1.45;

  const renderNewAnime = useCallback(
    ({ item }: ListRenderItemInfo<NewAnimeList>) => (
      <ListAnimeComponent
        gap
        newAnimeData={item}
        key={'btn' + item.title + item.episode}
        navigationProp={props.navigation}
      />
    ),
    [props.navigation],
  );

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>EPISODE TERBARU</Text>
        <TouchableOpacity
          style={styles.seeMoreButton}
          onPress={() => props.navigation.dispatch(StackActions.push('SeeMore', { type: 'AnimeList' }))}>
          <Text style={styles.seeMoreText}>LIHAT SEMUA</Text>
        </TouchableOpacity>
      </View>
      {(data?.newAnime.length || 0) > 0 ? (
        <FlashList
          renderScrollComponent={RenderScrollComponent}
          contentContainerStyle={{ gap: 4, paddingHorizontal: 4 }}
          horizontal
          data={data?.newAnime ?? []}
          renderItem={renderNewAnime}
          keyExtractor={z => 'episode' + z.title + z.episode}
          extraData={styles}
          showsHorizontalScrollIndicator={false}
        />
      ) : isRefreshing ? (
        <ShowSkeletonLoading />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 }}>
          <MaterialIcon name="error-outline" size={20} color="#d80000" />
          <Text style={styles.errorText}>Gagal mendapatkan data</Text>
        </View>
      )}
    </View>
  );
}

const FeaturedFilmList = memo(FeaturedFilmListUNMEMO);
function FeaturedFilmListUNMEMO({ props, data, isError }: { props: HomeProps; data: FilmHomePage; isError: boolean }) {
  const styles = useStyles();
  const renderMovie = useCallback(
    ({ item }: ListRenderItemInfo<FilmHomePage[number]>) => (
      <ListAnimeComponent gap newAnimeData={item} type="film" key={'btn' + item.title} navigationProp={props.navigation} />
    ),
    [props.navigation],
  );
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>FILM UNGGULAN</Text>
      </View>
      {isError ? (
        <Text style={styles.errorText}>Gagal mendapatkan data</Text>
      ) : data?.length !== 0 ? (
        <FlashList renderScrollComponent={RenderScrollComponent} contentContainerStyle={{ gap: 4, paddingHorizontal: 4 }} horizontal data={data?.slice(0, 25) ?? []} renderItem={renderMovie} keyExtractor={z => 'featured' + z.title} extraData={styles} showsHorizontalScrollIndicator={false} />
      ) : (
        <ShowSkeletonLoading />
      )}
    </View>
  );
}

const TrendingFilmList = memo(TrendingFilmListUNMEMO);
function TrendingFilmListUNMEMO({ props, data, isError }: { props: HomeProps; data: FilmHomePage; isError: boolean }) {
  const styles = useStyles();
  const renderMovie = useCallback(
    ({ item }: ListRenderItemInfo<FilmHomePage[number]>) => (
      <ListAnimeComponent gap newAnimeData={item} type="film" key={'btn' + item.title} navigationProp={props.navigation} />
    ),
    [props.navigation],
  );
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>FILM TRENDING</Text>
      </View>
      {isError ? (
        <Text style={styles.errorText}>Gagal mendapatkan data</Text>
      ) : data?.length !== 0 ? (
        <FlashList renderScrollComponent={RenderScrollComponent} contentContainerStyle={{ gap: 4, paddingHorizontal: 4 }} horizontal data={data?.slice(0, 25) ?? []} renderItem={renderMovie} keyExtractor={z => 'trending' + z.title} extraData={styles} showsHorizontalScrollIndicator={false} />
      ) : (
        <ShowSkeletonLoading />
      )}
    </View>
  );
}

const LatestFilmList = memo(LatestFilmListUNMEMO);
function LatestFilmListUNMEMO({ props }: { props: HomeProps }) {
  const styles = useStyles();
  const { paramsState: data, setParamsState: setData } = useContext(FilmListHomeContext);
  const [isError, setIsError] = useState(false);
  const renderMovie = useCallback(
    ({ item }: ListRenderItemInfo<FilmHomePage[number]>) => (
      <ListAnimeComponent gap newAnimeData={item} type="film" key={'btn' + item.title} navigationProp={props.navigation} />
    ),
    [props.navigation],
  );
  useEffect(() => {
    setData?.([]);
    queueMicrotask(() => {
      getLatestMovies().then(movieData => {
        if ('isError' in movieData) setIsError(true);
        else setData?.(movieData);
      }).catch(() => setIsError(true));
    });
  }, [setData]);
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>FILM TERBARU</Text>
        <TouchableOpacity style={styles.seeMoreButton} onPress={() => props.navigation.dispatch(StackActions.push('SeeMore', { type: 'FilmList' }))}>
          <Text style={styles.seeMoreText}>LIHAT SEMUA</Text>
        </TouchableOpacity>
      </View>
      {isError ? <Text style={styles.errorText}>Gagal mendapatkan data</Text>
      : data?.length !== 0 ? (
        <FlashList renderScrollComponent={RenderScrollComponent} contentContainerStyle={{ gap: 4, paddingHorizontal: 4 }} horizontal data={data?.slice(0, 36) ?? []} renderItem={renderMovie} keyExtractor={z => 'latest' + z.title} extraData={styles} showsHorizontalScrollIndicator={false} />
      ) : <ShowSkeletonLoading />}
    </View>
  );
}

const LatestSeriesList = memo(LatestSeriesListUNMEMO);
function LatestSeriesListUNMEMO({ props }: { props: HomeProps }) {
  const styles = useStyles();
  const { paramsState: data, setParamsState: setData } = useContext(SeriesListHomeContext);
  const [isError, setIsError] = useState(false);
  const renderMovie = useCallback(
    ({ item }: ListRenderItemInfo<FilmHomePage[number]>) => (
      <ListAnimeComponent gap newAnimeData={item} type="film" key={'btn' + item.title} navigationProp={props.navigation} />
    ),
    [props.navigation],
  );
  useEffect(() => {
    setData?.([]);
    queueMicrotask(() => {
      getLatestSeries().then(movieData => setData?.(movieData)).catch(() => setIsError(true));
    });
  }, [setData]);
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>SERIES TERBARU</Text>
        <TouchableOpacity style={styles.seeMoreButton} onPress={() => props.navigation.dispatch(StackActions.push('SeeMore', { type: 'SeriesList' }))}>
          <Text style={styles.seeMoreText}>LIHAT SEMUA</Text>
        </TouchableOpacity>
      </View>
      {isError ? <Text style={styles.errorText}>Gagal mendapatkan data</Text>
      : data?.length !== 0 ? (
        <FlashList renderScrollComponent={RenderScrollComponent} contentContainerStyle={{ gap: 4, paddingHorizontal: 4 }} horizontal data={data?.slice(0, 36) ?? []} renderItem={renderMovie} keyExtractor={z => 'series' + z.title} extraData={styles} showsHorizontalScrollIndicator={false} />
      ) : <ShowSkeletonLoading />}
    </View>
  );
}

const MovieList = memo(MovieListUNMEMO);
function MovieListUNMEMO({ props }: { props: HomeProps }) {
  const styles = useStyles();
  const { paramsState: data, setParamsState: setData } = useContext(MovieListHomeContext);
  const [isError, setIsError] = useState(false);
  const navigation = useNavigation<NavigationProp<RootStackNavigator>>();
  const renderMovie = useCallback(
    ({ item }: ListRenderItemInfo<Movies>) => (
      <ListAnimeComponent gap newAnimeData={item} type="movie" key={'btn' + item.title} navigationProp={props.navigation} />
    ),
    [props.navigation],
  );
  useEffect(() => {
    setData?.([]);
    queueMicrotask(() => {
      getLatestMovie().then(movieData => {
        if ('isError' in movieData) setIsError(true);
        else setData?.(movieData);
      }).catch(() => setIsError(true));
    });
  }, [setData]);
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>MOVIE TERBARU</Text>
        <TouchableOpacity style={styles.seeMoreButton} disabled={data?.length === 0} onPress={() => props.navigation.dispatch(StackActions.push('SeeMore', { type: 'MovieList' }))}>
          <Text style={styles.seeMoreText}>LIHAT SEMUA</Text>
        </TouchableOpacity>
      </View>
      {isError ? (
        <TouchableOpacity onPress={() => navigation.reset({ index: 0, routes: [{ name: 'connectToServer' }] })} style={styles.errorContainer}>
          <MaterialIcon name="refresh" size={20} color="#d80000" />
          <Text style={styles.errorText}>Ketuk untuk coba ulang</Text>
        </TouchableOpacity>
      ) : data?.length !== 0 ? (
        <FlashList renderScrollComponent={RenderScrollComponent} contentContainerStyle={{ gap: 4, paddingHorizontal: 4 }} horizontal data={data?.slice(0, 25) ?? []} renderItem={renderMovie} keyExtractor={z => z.title} extraData={styles} showsHorizontalScrollIndicator={false} />
      ) : <ShowSkeletonLoading />}
    </View>
  );
}

const ComicList = memo(ComicListUNMEMO);
function ComicListUNMEMO() {
  const styles = useStyles();
  const [isError, setIsError] = useState(false);
  const navigation = useNavigation<NavigationProp<RootStackNavigator, 'AnimeDetail'>>();
  const { paramsState: data, setParamsState: setData } = useContext(ComicsListContext);
  useEffect(() => {
    queueMicrotask(() => {
      getLatestComicsReleases().then(z => setData?.(z)).catch(() => setIsError(true));
    });
    return () => setData?.([]);
  }, [setData]);
  const renderComics = useCallback(
    ({ item }: ListRenderItemInfo<LatestComicsRelease>) => (
      // @ts-expect-error
      <ListAnimeComponent gap newAnimeData={item} type="comics" key={'btn' + item.title} navigationProp={navigation} />
    ),
    [navigation],
  );
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>KOMIK TERBARU</Text>
        <TouchableOpacity style={styles.seeMoreButton} disabled={data?.length === 0} onPress={() => navigation.dispatch(StackActions.push('SeeMore', { type: 'ComicsList' }))}>
          <Text style={styles.seeMoreText}>LIHAT SEMUA</Text>
        </TouchableOpacity>
      </View>
      {isError ? <Text style={styles.errorText}>Gagal mendapatkan data</Text>
      : data && data?.length !== 0 ? (
        <FlashList renderScrollComponent={RenderScrollComponent} contentContainerStyle={{ gap: 4, paddingHorizontal: 4 }} horizontal data={data.slice(0, 24)} renderItem={renderComics} keyExtractor={z => z.title} extraData={styles} showsHorizontalScrollIndicator={false} />
      ) : <ShowSkeletonLoading />}
    </View>
  );
}

function ShowSkeletonLoading({ grid }: { grid?: boolean }) {
  const dimensions = useWindowDimensions();
  const LIST_W = dimensions.width * 0.32;
  const LIST_H = LIST_W * 1.45;
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 4 }}>
      {[1, 2, 3].map((_, i) => (
        <Skeleton key={i} width={LIST_W} height={LIST_H} style={{ borderRadius: 8 }} />
      ))}
    </View>
  );
}

function JadwalComponent({ item, props }: { item: keyof JadwalAnime; props: HomeProps }) {
  const styles = useStyles();
  const { paramsState: data } = use(EpisodeBaruHomeContext);
  const { getMappingKey } = useMappingHelper();
  return (
    <View style={[styles.scheduleContainer, styles.scheduleSection]}>
      <Text style={styles.scheduleDay}>{item}</Text>
      {data?.jadwalAnime[item]!.map((x, index) => (
        <TouchableOpacity
          style={[styles.scheduleItem, index % 2 === 0 ? styles.scheduleItemEven : styles.scheduleItemOdd]}
          key={getMappingKey(x.title, index)}
          onPress={() => {
            props.navigation.dispatch(StackActions.push('FromUrl', { title: x.title, link: x.link }));
          }}>
          <Text style={styles.scheduleTitle}>{x.title}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function RenderScrollComponent(renderProps: ScrollViewProps) {
  return <ScrollView {...renderProps} />;
}

function useStyles() {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const isDark = colorScheme === 'dark';

  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: isDark ? '#111' : '#f0f0f0',
        },
        header: {
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 8,
        },
        headerTitle: {
          fontSize: 32,
          fontWeight: 'bold',
          color: isDark ? '#fff' : '#111',
          letterSpacing: 2,
        },
        sectionContainer: {
          paddingVertical: 10,
          marginBottom: 4,
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 12,
          marginBottom: 10,
        },
        sectionTitle: {
          fontSize: 13,
          fontWeight: 'bold',
          color: isDark ? '#E0E0E0' : '#222',
          letterSpacing: 1,
        },
        seeMoreButton: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        seeMoreText: {
          fontSize: 11,
          fontWeight: 'bold',
          color: theme.colors.primary,
          letterSpacing: 0.5,
        },
        scheduleSection: {
          backgroundColor: isDark ? '#1a1a1a' : '#fff',
          borderRadius: 8,
          padding: 12,
          marginHorizontal: 12,
          marginBottom: 12,
          elevation: 1,
        },
        scheduleContainer: { marginBottom: 12 },
        scheduleDay: {
          fontSize: 13,
          fontWeight: 'bold',
          color: theme.colors.primary,
          marginBottom: 6,
          textAlign: 'center',
          letterSpacing: 1,
        },
        scheduleItem: { paddingVertical: 10, paddingHorizontal: 12 },
        scheduleItemEven: { backgroundColor: isDark ? '#252525' : '#f5f5f5' },
        scheduleItemOdd: { backgroundColor: isDark ? '#1a1a1a' : '#fff' },
        scheduleTitle: { fontSize: 13, color: isDark ? '#e0e0e0' : '#333', textAlign: 'center' },
        errorContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
          backgroundColor: isDark ? '#2A1E1E' : '#FFEBEE',
          borderRadius: 8,
          marginHorizontal: 12,
          gap: 8,
        },
        errorText: {
          fontSize: 12,
          color: '#d80000',
          textAlign: 'center',
        },
      }),
    [isDark, theme.colors.primary],
  );
}
