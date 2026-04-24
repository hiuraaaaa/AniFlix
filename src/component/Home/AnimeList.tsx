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
  ScrollViewProps,
  StyleSheet,
  Text,
  ToastAndroid,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EpisodeBaruHome as EpisodeBaruType, JadwalAnime, NewAnimeList } from '@/types/anime';
import { HomeNavigator, RootStackNavigator } from '@/types/navigation';
import useGlobalStyles from '@assets/style';
import Announcment from '@component/misc/Announcement';
import { ListAnimeComponent } from '@component/misc/ListAnimeComponent';
import Skeleton from '@component/misc/Skeleton';
import { TouchableOpacity } from '@component/misc/TouchableOpacityRNGH';
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

type HomeProps = BottomTabScreenProps<HomeNavigator, 'AnimeList'>;

const Home = memo(HomeList);
export default Home;

function HomeList(props: HomeProps) {
  const globalStyles = useGlobalStyles();
  const colorScheme = useColorScheme();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { paramsState: data, setParamsState: setData } = useContext(EpisodeBaruHomeContext);
  const [refresh, setRefresh] = useState(false);
  const [refreshingKey, setRefreshingKey] = useState(0);
  const windowSize = useWindowDimensions();



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
    ({ item }: { item: keyof JadwalAnime }) => {
      return <JadwalComponent item={item} props={props} />;
    },
    [props],
  );

  const listRef = useRef<LegendListRef>(null);
  const [jadwalHidden, setJadwalHidden] = useState(true);
  const toggleJadwal = useCallback(() => {
    setJadwalHidden(x => !x);
  }, []);
  useEffect(() => {
    if (!jadwalHidden) {
      listRef.current?.scrollToIndex({
        index: 0,
        animated: true,
        viewPosition: 0.5,
      });
    }
  }, [jadwalHidden]);
  const jadwalDataArray = useMemo(
    () => (jadwalHidden ? [] : Object.keys(data?.jadwalAnime ?? {})),
    [data?.jadwalAnime, jadwalHidden],
  );

  const [filmHomepageData, setFilmHomepageData] = useState<Awaited<ReturnType<typeof getHomepage>>>(
    {
      featured: [],
      trending: [],
    },
  );
  const [isFilmError, setIsFilmError] = useState(false);

  useEffect(() => {
    setFilmHomepageData({
      featured: [],
      trending: [],
    });
    setIsFilmError(false);
    queueMicrotask(() => {
      getHomepage()
        .then(setFilmHomepageData)
        .catch(() => {
          setIsFilmError(true);
        });
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
          progressBackgroundColor={colorScheme === 'dark' ? '#121212' : '#ffffff'}
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
            style={[
              styles.scheduleSection,
              { flexDirection: 'row', justifyContent: 'space-between' },
            ]}>
            <Text style={styles.sectionTitle}>Jadwal Anime</Text>
            <MaterialIcons
              name={jadwalHidden ? 'arrow-downward' : 'arrow-upward'}
              size={20}
              color={styles.sectionTitle.color}
            />
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

const FeaturedFilmList = memo(FeaturedFilmListUNMEMO);
function FeaturedFilmListUNMEMO({
  props,
  data,
  isError,
}: {
  props: HomeProps;
  data: FilmHomePage;
  isError: boolean;
}) {
  const styles = useStyles();

  const renderMovie = useCallback(
    ({ item }: ListRenderItemInfo<FilmHomePage[number]>) => (
      <ListAnimeComponent
        gap
        newAnimeData={item}
        type="film"
        key={'btn' + item.title}
        navigationProp={props.navigation}
      />
    ),
    [props.navigation],
  );

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Film Unggulan</Text>
      </View>

      {isError && (
        <View>
          <MaterialIcon name="error-outline" size={24} color="#d80000" />
          <Text style={styles.errorText}>
            Error mendapatkan data. Silahkan refresh data untuk mencoba lagi
          </Text>
        </View>
      )}

      {data?.length !== 0 ? (
        <FlashList
          renderScrollComponent={RenderScrollComponent}
          contentContainerStyle={{ gap: 3 }}
          horizontal
          data={data?.slice(0, 25) ?? []}
          renderItem={renderMovie}
          keyExtractor={z => 'featured' + z.title}
          extraData={styles}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        !isError && <ShowSkeletonLoading />
      )}
    </View>
  );
}

const TrendingFilmList = memo(TrendingFilmListUNMEMO);
function TrendingFilmListUNMEMO({
  props,
  data,
  isError,
}: {
  props: HomeProps;
  data: FilmHomePage;
  isError: boolean;
}) {
  const styles = useStyles();

  const renderMovie = useCallback(
    ({ item }: ListRenderItemInfo<FilmHomePage[number]>) => (
      <ListAnimeComponent
        gap
        newAnimeData={item}
        type="film"
        key={'btn' + item.title}
        navigationProp={props.navigation}
      />
    ),
    [props.navigation],
  );

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Film Trending</Text>
      </View>

      {isError && (
        <View>
          <MaterialIcon name="error-outline" size={24} color="#d80000" />
          <Text style={styles.errorText}>
            Error mendapatkan data. Silahkan refresh data untuk mencoba lagi
          </Text>
        </View>
      )}

      {data?.length !== 0 ? (
        <FlashList
          renderScrollComponent={RenderScrollComponent}
          contentContainerStyle={{ gap: 3 }}
          horizontal
          data={data?.slice(0, 25) ?? []}
          renderItem={renderMovie}
          keyExtractor={z => 'featured' + z.title}
          extraData={styles}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        !isError && <ShowSkeletonLoading />
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
      <ListAnimeComponent
        gap
        newAnimeData={item}
        type="film"
        key={'btn' + item.title}
        navigationProp={props.navigation}
      />
    ),
    [props.navigation],
  );

  useEffect(() => {
    setData?.([]);
    queueMicrotask(() => {
      getLatestMovies()
        .then(movieData => {
          if ('isError' in movieData) {
            setIsError(true);
          } else {
            setData?.(movieData);
          }
        })
        .catch(() => setIsError(true));
    });
  }, [setData]);
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Film Terbaru</Text>
        <TouchableOpacity
          style={styles.seeMoreButton}
          onPress={() => {
            props.navigation.dispatch(StackActions.push('SeeMore', { type: 'FilmList' }));
          }}>
          <Text style={styles.seeMoreText}>Lihat Semua</Text>
          <MaterialIcon name="chevron-right" style={styles.seeMoreText} />
        </TouchableOpacity>
      </View>

      {isError && (
        <View>
          <MaterialIcon name="error-outline" size={24} color="#d80000" />
          <Text style={styles.errorText}>
            Error mendapatkan data. Silahkan refresh data untuk mencoba lagi
          </Text>
        </View>
      )}

      {data?.length !== 0 ? (
        <FlashList
          renderScrollComponent={RenderScrollComponent}
          contentContainerStyle={{ gap: 3 }}
          horizontal
          data={data?.slice(0, 36) ?? []}
          renderItem={renderMovie}
          keyExtractor={z => 'latest' + z.title}
          extraData={styles}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        !isError && <ShowSkeletonLoading />
      )}
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
      <ListAnimeComponent
        gap
        newAnimeData={item}
        type="film"
        key={'btn' + item.title}
        navigationProp={props.navigation}
      />
    ),
    [props.navigation],
  );

  useEffect(() => {
    setData?.([]);
    queueMicrotask(() => {
      getLatestSeries()
        .then(movieData => {
          setData?.(movieData);
        })
        .catch(() => setIsError(true));
    });
  }, [setData]);
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Series Terbaru</Text>
        <TouchableOpacity
          style={styles.seeMoreButton}
          onPress={() => {
            props.navigation.dispatch(StackActions.push('SeeMore', { type: 'SeriesList' }));
          }}>
          <Text style={styles.seeMoreText}>Lihat Semua</Text>
          <MaterialIcon name="chevron-right" style={styles.seeMoreText} />
        </TouchableOpacity>
      </View>

      {isError && (
        <View>
          <MaterialIcon name="error-outline" size={24} color="#d80000" />
          <Text style={styles.errorText}>
            Error mendapatkan data. Silahkan refresh data untuk mencoba lagi
          </Text>
        </View>
      )}

      {data?.length !== 0 ? (
        <FlashList
          renderScrollComponent={RenderScrollComponent}
          contentContainerStyle={{ gap: 3 }}
          horizontal
          data={data?.slice(0, 36) ?? []}
          renderItem={renderMovie}
          keyExtractor={z => 'latest' + z.title}
          extraData={styles}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        !isError && <ShowSkeletonLoading />
      )}
    </View>
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
  styles,
  data,
  props,
  isRefreshing,
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
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Episode Anime Terbaru</Text>
        <TouchableOpacity
          style={styles.seeMoreButton}
          onPress={() => {
            props.navigation.dispatch(StackActions.push('SeeMore', { type: 'AnimeList' }));
          }}>
          <Text style={styles.seeMoreText}>Lihat Semua</Text>
          <MaterialIcon name="chevron-right" style={styles.seeMoreText} />
        </TouchableOpacity>
      </View>
      {(data?.newAnime.length || 0) > 0 ? (
        <FlashList
          renderScrollComponent={RenderScrollComponent}
          contentContainerStyle={{ gap: 3 }}
          horizontal
          data={(data?.newAnime ?? []).slice(0, 25)}
          keyExtractor={z => z.title}
          renderItem={renderNewAnime}
          extraData={styles}
          showsHorizontalScrollIndicator={false}
        />
      ) : isRefreshing ? (
        <ShowSkeletonLoading />
      ) : (
        <View>
          <MaterialIcon name="error-outline" size={24} color="#d80000" />
          <Text style={styles.errorText}>
            Error mendapatkan data. Silahkan refresh data untuk mencoba lagi
          </Text>
        </View>
      )}
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
      <ListAnimeComponent
        gap
        newAnimeData={item}
        type="movie"
        key={'btn' + item.title}
        navigationProp={props.navigation}
      />
    ),
    [props.navigation],
  );

  useEffect(() => {
    setData?.([]);
    queueMicrotask(() => {
      getLatestMovie()
        .then(movieData => {
          if ('isError' in movieData) {
            setIsError(true);
          } else {
            setData?.(movieData);
          }
        })
        .catch(() => setIsError(true));
    });
  }, [setData]);

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Movie Terbaru</Text>
        <TouchableOpacity
          style={styles.seeMoreButton}
          disabled={data?.length === 0}
          onPress={() => {
            props.navigation.dispatch(StackActions.push('SeeMore', { type: 'MovieList' }));
          }}>
          <Text style={styles.seeMoreText}>Lihat Semua</Text>
          <MaterialIcon name="chevron-right" style={styles.seeMoreText} />
        </TouchableOpacity>
      </View>

      {isError && (
        <TouchableOpacity
          onPress={() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'connectToServer' }],
            });
          }}
          style={styles.errorContainer}>
          <MaterialIcon name="refresh" size={24} color="#d80000" />
          <Text style={styles.errorText}>
            Error mendapatkan data. Ketuk disini untuk mencoba ulang.
          </Text>
        </TouchableOpacity>
      )}

      {data?.length !== 0 ? (
        <FlashList
          renderScrollComponent={RenderScrollComponent}
          contentContainerStyle={{ gap: 3 }}
          horizontal
          data={data?.slice(0, 25) ?? []}
          renderItem={renderMovie}
          keyExtractor={z => z.title}
          extraData={styles}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        !isError && <ShowSkeletonLoading />
      )}
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
      getLatestComicsReleases()
        .then(z => {
          setData?.(z);
        })
        .catch(() => setIsError(true));
    });
    return () => {
      setData?.([]);
    };
  }, [setData]);

  const renderComics = useCallback(
    ({ item }: ListRenderItemInfo<LatestComicsRelease>) => (
      <ListAnimeComponent
        gap
        newAnimeData={item}
        type="comics"
        key={'btn' + item.title}
        // @ts-expect-error
        navigationProp={navigation}
      />
    ),
    [navigation],
  );

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Komik Terbaru</Text>
        <TouchableOpacity
          style={styles.seeMoreButton}
          disabled={data?.length === 0}
          onPress={() => {
            navigation.dispatch(StackActions.push('SeeMore', { type: 'ComicsList' }));
          }}>
          <Text style={styles.seeMoreText}>Lihat Semua</Text>
          <MaterialIcon name="chevron-right" style={styles.seeMoreText} />
        </TouchableOpacity>
      </View>

      {isError && (
        <View>
          <MaterialIcon name="error-outline" size={24} color="#d80000" />
          <Text style={styles.errorText}>
            Error mendapatkan data. Silahkan refresh data untuk mencoba lagi
          </Text>
        </View>
      )}

      {data && data?.length !== 0 ? (
        <FlashList
          renderScrollComponent={RenderScrollComponent}
          contentContainerStyle={{ gap: 3 }}
          horizontal
          data={data.slice(0, 24)}
          renderItem={renderComics}
          keyExtractor={z => z.title}
          extraData={styles}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        !isError && <ShowSkeletonLoading />
      )}
    </View>
  );
}

function ShowSkeletonLoading() {
  const dimensions = useWindowDimensions();
  let LIST_BACKGROUND_HEIGHT = (dimensions.height * 120) / 200 / 3.5;
  let LIST_BACKGROUND_WIDTH = (dimensions.width * 120) / 200 / 2.8;
  LIST_BACKGROUND_HEIGHT = Math.max(LIST_BACKGROUND_HEIGHT, MIN_IMAGE_HEIGHT);
  LIST_BACKGROUND_WIDTH = Math.max(LIST_BACKGROUND_WIDTH, MIN_IMAGE_WIDTH);
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3].map((_, index) => (
        <View key={index} style={{ gap: 3 }}>
          <Skeleton
            key={index + 'image'}
            width={LIST_BACKGROUND_WIDTH}
            height={LIST_BACKGROUND_HEIGHT}
            style={{ borderRadius: 6 }}
          />
          <Skeleton key={index + 'title'} width={LIST_BACKGROUND_WIDTH} height={16} />
          <View key={index + 'info'} style={{ flexDirection: 'row', gap: 2 }}>
            <Skeleton key={index + 'info1'} width={LIST_BACKGROUND_WIDTH / 2} height={16} />
            <Skeleton key={index + 'info2'} width={LIST_BACKGROUND_WIDTH / 2} height={16} />
          </View>
        </View>
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
          style={[
            styles.scheduleItem,
            index % 2 === 0 ? styles.scheduleItemEven : styles.scheduleItemOdd,
          ]}
          key={getMappingKey(x.title, index)}
          onPress={() => {
            props.navigation.dispatch(
              StackActions.push('FromUrl', {
                title: x.title,
                link: x.link,
              }),
            );
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
          backgroundColor: isDark ? '#121212' : '#f0f0f0',
        },
        sectionContainer: {
          backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
          borderRadius: 12,
          paddingVertical: 8,
          marginHorizontal: 3,
          marginBottom: 12,
          elevation: 1,
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 12,
          marginBottom: 8,
        },
        sectionTitle: {
          fontSize: 15,
          fontWeight: 'bold',
          color: isDark ? '#E0E0E0' : '#333',
        },
        seeMoreButton: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        seeMoreText: {
          fontSize: 12,
          fontWeight: 'bold',
          color: theme.colors.primary,
          marginRight: 2,
        },
        scheduleSection: {
          backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
          borderRadius: 12,
          padding: 12,
          marginHorizontal: 12,
          marginBottom: 12,
          elevation: 1,
        },
        scheduleContainer: {
          marginBottom: 12,
        },
        scheduleDay: {
          fontSize: 14,
          fontWeight: 'bold',
          color: theme.colors.primary,
          marginBottom: 6,
          textAlign: 'center',
        },
        scheduleItem: {
          paddingVertical: 10,
          paddingHorizontal: 12,
        },
        scheduleItemEven: {
          backgroundColor: isDark ? '#252525' : '#F5F5F5',
        },
        scheduleItemOdd: {
          backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
        },
        scheduleTitle: {
          fontSize: 13,
          color: isDark ? '#E0E0E0' : '#333',
          textAlign: 'center',
        },
        errorContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
          backgroundColor: isDark ? '#2A1E1E' : '#FFEBEE',
          borderRadius: 8,
          marginHorizontal: 12,
        },
        errorText: {
          fontSize: 13,
          color: '#d80000',
          marginLeft: 6,
          textAlign: 'center',
        },
      }),
    [isDark, theme.colors.primary],
  );
}
