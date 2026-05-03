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
const BANNER_HEIGHT = 300;

type HomeProps = BottomTabScreenProps<HomeNavigator, 'AnimeList'>;

const Home = memo(HomeList);
export default Home;

function SectionHeader({
  title,
  subtitle,
  onSeeMore,
  styles,
}: {
  title: string;
  subtitle: string;
  onSeeMore?: () => void;
  styles: ReturnType<typeof useStyles>;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {onSeeMore && (
        <TouchableOpacity style={styles.seeMoreButton} onPress={onSeeMore}>
          <Text style={styles.seeMoreText}>LIHAT SEMUA</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function BannerCarousel({ data, navigation }: { data: FilmHomePage; navigation: HomeProps['navigation'] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<RNScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const items = data.slice(0, 8);
  const isScrolling = useRef(false);

  const goToIndex = useCallback((next: number) => {
    if (isScrolling.current) return;
    isScrolling.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.04, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setActiveIndex(next);
      scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: false });
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        isScrolling.current = false;
      });
    });
  }, [fadeAnim, scaleAnim]);

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
    <View style={bannerStyles.wrapper}>
      <RNScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={StyleSheet.absoluteFill}>
        {items.map((item, i) => (
          <Animated.View
            key={i}
            style={{
              width: SCREEN_WIDTH,
              height: BANNER_HEIGHT,
              transform: [{ scale: i === activeIndex ? scaleAnim : new Animated.Value(1) }],
            }}>
            <ImageLoading
              source={{ uri: item.thumbnailUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </Animated.View>
        ))}
      </RNScrollView>

      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'transparent']}
        style={bannerStyles.topGradient}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.98)']}
        style={bannerStyles.bottomGradient}
      />

      <Animated.View style={[bannerStyles.contentOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.dispatch(StackActions.push('FromUrl', {
            title: currentItem?.title,
            link: currentItem?.url,
            type: 'film',
          }))}
          style={bannerStyles.contentTouchable}>
          <View style={bannerStyles.badgeRow}>
            <View style={[bannerStyles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text style={bannerStyles.badgeText}>UNGGULAN</Text>
            </View>
            {'rating' in currentItem && currentItem.rating && (
              <View style={bannerStyles.ratingRow}>
                <MaterialIcon name="star" size={13} color="#FFD700" />
                <Text style={bannerStyles.ratingText}>{currentItem.rating}</Text>
              </View>
            )}
          </View>
          <Text numberOfLines={2} style={bannerStyles.title}>
            {currentItem?.title}
          </Text>
          {'synopsis' in currentItem && currentItem.synopsis ? (
            <Text numberOfLines={2} style={bannerStyles.synopsis}>
              {currentItem.synopsis}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={() => navigation.dispatch(StackActions.push('FromUrl', {
              title: currentItem?.title,
              link: currentItem?.url,
              type: 'film',
            }))}
            style={[bannerStyles.watchButton, { backgroundColor: theme.colors.primary }]}>
            <MaterialIcon name="play-arrow" size={18} color="#fff" />
            <Text style={bannerStyles.watchButtonText}>Tonton</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>

      <View style={bannerStyles.dotsRow}>
        {items.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goToIndex(i)}>
            <View style={[
              bannerStyles.dot,
              {
                width: i === activeIndex ? 20 : 6,
                backgroundColor: i === activeIndex ? theme.colors.primary : isDark ? '#555' : '#aaa',
              },
            ]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  wrapper: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    marginBottom: 8,
    overflow: 'hidden',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 1,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 1,
  },
  contentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  contentTouchable: { gap: 6 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  synopsis: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 17,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    marginTop: 4,
    elevation: 4,
  },
  watchButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    flexDirection: 'row',
    gap: 4,
    zIndex: 3,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
});

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
          <View style={styles.header}>
            <Image
              source={require('@assets/lunar-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {filmHomepageData.featured.length > 0 && (
            <BannerCarousel data={filmHomepageData.featured} navigation={props.navigation} />
          )}

          <EpisodeBaru
            isRefreshing={refresh}
            styles={styles}
            globalStyles={globalStyles}
            data={data}
            props={props}
          />

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
            style={[styles.scheduleSection, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View>
              <Text style={styles.sectionTitle}>JADWAL ANIME</Text>
              <Text style={styles.sectionSubtitle}>Jadwal tayang mingguan</Text>
            </View>
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
      <SectionHeader
        title="EPISODE TERBARU"
        subtitle="Anime terbaru hari ini"
        onSeeMore={() => props.navigation.dispatch(StackActions.push('SeeMore', { type: 'AnimeList' }))}
        styles={styles}
      />
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
      <SectionHeader title="FILM UNGGULAN" subtitle="Film pilihan terbaik" styles={styles} />
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
      <SectionHeader title="FILM TRENDING" subtitle="Sedang populer sekarang" styles={styles} />
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
      <SectionHeader
        title="FILM TERBARU"
        subtitle="Update film terkini"
        onSeeMore={() => props.navigation.dispatch(StackActions.push('SeeMore', { type: 'FilmList' }))}
        styles={styles}
      />
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
      <SectionHeader
        title="SERIES TERBARU"
        subtitle="Series episode terkini"
        onSeeMore={() => props.navigation.dispatch(StackActions.push('SeeMore', { type: 'SeriesList' }))}
        styles={styles}
      />
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
      <SectionHeader
        title="MOVIE TERBARU"
        subtitle="Anime movie pilihan"
        onSeeMore={() => props.navigation.dispatch(StackActions.push('SeeMore', { type: 'MovieList' }))}
        styles={styles}
      />
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
      <SectionHeader
        title="KOMIK TERBARU"
        subtitle="Update komik terkini"
        onSeeMore={() => navigation.dispatch(StackActions.push('SeeMore', { type: 'ComicsList' }))}
        styles={styles}
      />
      {isError ? <Text style={styles.errorText}>Gagal mendapatkan data</Text>
      : data && data?.length !== 0 ? (
        <FlashList renderScrollComponent={RenderScrollComponent} contentContainerStyle={{ gap: 4, paddingHorizontal: 4 }} horizontal data={data.slice(0, 24)} renderItem={renderComics} keyExtractor={z => z.title} extraData={styles} showsHorizontalScrollIndicator={false} />
      ) : <ShowSkeletonLoading />}
    </View>
  );
}

function ShowSkeletonLoading() {
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
          paddingHorizontal: 8,
          paddingTop: 12,
          paddingBottom: 8,
        },
        logo: {
          height: 42,
          width: 160,
          alignSelf: 'flex-start',
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
          marginBottom: 12,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: 'bold',
          color: isDark ? '#FFFFFF' : '#111',
          letterSpacing: 0.5,
        },
        sectionSubtitle: {
          fontSize: 11,
          color: isDark ? '#666' : '#aaa',
          marginTop: 2,
          letterSpacing: 0.3,
        },
        seeMoreButton: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.primary,
        },
        seeMoreText: {
          fontSize: 10,
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
