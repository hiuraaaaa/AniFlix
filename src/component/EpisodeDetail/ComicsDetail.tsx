import Icon from '@react-native-vector-icons/fontawesome';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { RecyclerViewProps } from '@shopify/flash-list/dist/recyclerview/RecyclerViewProps';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button, Chip, Divider, useTheme } from 'react-native-paper';
import Reanimated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HistoryItemKey } from '@/types/databaseTarget';
import { HistoryJSON } from '@/types/historyJSON';
import { RootStackNavigator } from '@/types/navigation';
import watchLaterJSON from '@/types/watchLaterJSON';
import useGlobalStyles from '@assets/style';
import ImageLoading from '@component/misc/ImageLoading';
import { DatabaseManager, useModifiedKeyValueIfFocused } from '@utils/DatabaseManager';
import { __ALIAS as Comics1Alias } from '@utils/scrapers/comics1';
import { __ALIAS as Comics2Alias } from '@utils/scrapers/comics2';
import { ComicsDetail as ComicsDetailTypeData } from '@utils/scrapers/comicsv2';
import { __ALIAS as KomikuAlias, KomikuDetail } from '@utils/scrapers/komiku';
import controlWatchLater from '@utils/watchLaterControl';

type RecyclerViewType = (
  props: RecyclerViewProps<KomikuDetail['chapters'][0] | ComicsDetailTypeData['chapters'][0]> & {
    ref?: React.Ref<
      FlashListRef<KomikuDetail['chapters'][0] | ComicsDetailTypeData['chapters'][0]>
    >;
  },
) => React.JSX.Element;
const ReanimatedFlashList = Reanimated.createAnimatedComponent<RecyclerViewType>(FlashList);

type Props = NativeStackScreenProps<RootStackNavigator, 'ComicsDetail'>;
const IMG_HEIGHT = 280;

export default function ComicsDetail(props: Props) {
  const globalStyles = useGlobalStyles();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const scrollRef =
    useAnimatedRef<
      FlashListRef<KomikuDetail['chapters'][0] | ComicsDetailTypeData['chapters'][0]>
    >();
  const scrollOffset = useScrollOffset(scrollRef as any);
  const imageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [0, IMG_HEIGHT * 2],
            [0, IMG_HEIGHT],
            'clamp',
          ),
        },
      ],
      opacity: interpolate(scrollOffset.value, [0, IMG_HEIGHT], [1, 0], 'clamp'),
    };
  });
  const { data } = props.route.params;

  const [searchQuery, setSearchQuery] = useState('');
  const filteredChapters = useMemo(() => {
    if (!searchQuery) return data.chapters;
    return data.chapters.toReversed().filter(chapter => {
      return chapter.chapter.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [data.chapters, searchQuery]);

  const watchLaterListsJson = useModifiedKeyValueIfFocused(
    'watchLater',
    state => JSON.parse(state) as watchLaterJSON[],
  );
  const isInList = useMemo(
    () => watchLaterListsJson.some(item => item.title === data.title && item.isComics),
    [data.title, watchLaterListsJson],
  );

  const historyListsJson = useModifiedKeyValueIfFocused(
    'historyKeyCollectionsOrder',
    state => JSON.parse(state) as HistoryItemKey[],
  );
  const lastReaded = useMemo(() => {
    const isLastReaded = historyListsJson.find(
      z => z === `historyItem:${data.title.trim()}:true:false`,
    );
    if (isLastReaded) {
      return JSON.parse(DatabaseManager.getSync(isLastReaded)!) as HistoryJSON;
    } else return undefined;
  }, [historyListsJson, data.title]);

  const readComic = useCallback(
    (url: string, fromHistory?: HistoryJSON) => {
      let link = url;
      const currentScraper = [Comics1Alias, Comics2Alias, KomikuAlias].find(alias =>
        link.includes(alias),
      );
      const isSameScraper = props.route.params.link.includes(currentScraper ?? '');
      if (!isSameScraper) {
        const lastReadedData =
          lastReaded &&
          lastReaded.episode &&
          data.chapters.find(item => {
            return (
              item.chapter
                .toLowerCase()
                .replace('indonesianTitle' in data ? 'chapter 0' : '', '')
                .replace(item.chapterUrl.includes('softkomik') ? /^0+/ : '', '')
                .replace('chapter ', '')
                .trim() ===
              lastReaded?.episode
                ?.toLowerCase()
                .replace('indonesianTitle' in data ? 'chapter 0' : '', '')
                .replace(lastReaded.link.includes('softkomik') ? 'chapter 00' : '', '')
                .replace('chapter ', '')
                .replace(lastReaded.link.includes('softkomik') ? /^0+/ : '', '')
                .trim()
            );
          });
        if (
          typeof lastReadedData === 'object' &&
          lastReadedData !== null &&
          'chapter' in lastReadedData
        ) {
          link = lastReadedData.chapterUrl;
        }
      }
      props.navigation.navigate('FromUrl', {
        title: props.route.params.data.title,
        link,
        type: 'comics',
        historyData: fromHistory
          ? {
              lastDuration: fromHistory.lastDuration ?? 0,
              resolution: fromHistory.resolution ?? '',
            }
          : undefined,
      });
    },
    [data, lastReaded, props.navigation, props.route.params.data.title, props.route.params.link],
  );

  const listHeaderComponent = (
    <ComicsDetailHeader
      data={data}
      imageStyle={imageStyle}
      isInList={isInList}
      lastReaded={lastReaded}
      readComic={readComic}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      link={props.route.params.link}
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ReanimatedFlashList
        maintainVisibleContentPosition={{ disabled: true }}
        ref={scrollRef}
        data={filteredChapters}
        ListEmptyComponent={() => (
          <View style={[styles.mainContainer, { padding: 20 }]}>
            <Text style={globalStyles.text}>Tidak ada chapter</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <RenderChapterItem
            item={item}
            data={data}
            lastReaded={lastReaded}
            readComic={readComic}
          />
        )}
        ItemSeparatorComponent={() => <Divider style={styles.chapterDivider} />}
        keyExtractor={(item, index) => item.chapter + index}
        contentContainerStyle={{
          backgroundColor: styles.mainContainer.backgroundColor,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom + 20,
        }}
        ListHeaderComponentStyle={[styles.mainContainer, { marginBottom: 8 }]}
        ListHeaderComponent={listHeaderComponent}
        showsVerticalScrollIndicator={false}
      />
    </KeyboardAvoidingView>
  );
}

interface ComicsDetailHeaderProps {
  data: Props['route']['params']['data'];
  imageStyle: any;
  isInList: boolean;
  lastReaded: HistoryJSON | undefined;
  readComic: (url: string, fromHistory?: HistoryJSON) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  link: string;
}

const ComicsDetailHeader = memo(
  ({
    data,
    imageStyle,
    isInList,
    lastReaded,
    readComic,
    searchQuery,
    setSearchQuery,
    link,
  }: ComicsDetailHeaderProps) => {
    const styles = useStyles();
    const theme = useTheme();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
      <View style={styles.mainContainer}>
        {/* Hero Image */}
        <Reanimated.View style={[{ width: '100%', height: IMG_HEIGHT }, imageStyle]}>
          <ImageLoading
            source={{ uri: data.thumbnailUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', isDark ? '#0c0c0c' : '#ebebeb']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 120,
            }}
          />
        </Reanimated.View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Poster + Info Row */}
          <View style={styles.posterRow}>
            <ImageLoading
              source={{ uri: data.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="contain"
            />
            <View style={styles.infoContainer}>
              <Text style={styles.title} numberOfLines={3}>
                {data.title}
              </Text>
              <Text style={styles.altTitle} numberOfLines={2}>
                {'indonesianTitle' in data ? data.indonesianTitle : data.altTitle}
              </Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: isDark ? '#00608d' : '#5ddfff' }]}>
                  <Text style={styles.badgeText}>{data.type}</Text>
                </View>
                <View style={[styles.badge, {
                  borderWidth: 1,
                  borderColor: isDark ? '#fff' : '#333',
                  backgroundColor: 'transparent',
                }]}>
                  <Text style={[styles.badgeText, { color: isDark ? '#fff' : '#333' }]}>
                    {data.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.author}>
                <Icon name="user" size={12} color={styles.author.color} /> {data.author || '-'}
              </Text>
            </View>
          </View>

          {/* Genres */}
          {data.genres.length > 0 && (
            <View style={styles.genreContainer}>
              {data.genres.map(genre => (
                <Chip
                  key={genre}
                  compact
                  style={[
                    styles.genreChip,
                    genre === 'Ecchi' && { backgroundColor: 'rgba(255,0,0,0.3)' },
                  ]}
                  textStyle={styles.genreText}>
                  {genre}
                </Chip>
              ))}
            </View>
          )}

          {/* Info Pills */}
          {'indonesianTitle' in data && (
            <View style={styles.additionalInfo}>
              <View style={styles.infoPill}>
                <Icon name="child" size={12} color={theme.colors.primary} />
                <Text style={styles.infoPillText}>{data.minAge}</Text>
              </View>
              <View style={styles.infoPill}>
                <Icon name="map-signs" size={12} color={theme.colors.primary} />
                <Text style={styles.infoPillText}>{data.readingDirection}</Text>
              </View>
              <View style={styles.infoPill}>
                <Icon name="tag" size={12} color={theme.colors.primary} />
                <Text style={styles.infoPillText}>{data.concept}</Text>
              </View>
            </View>
          )}
          {'releaseYear' in data && (
            <View style={styles.additionalInfo}>
              <View style={styles.infoPill}>
                <Icon name="calendar" size={12} color={theme.colors.primary} />
                <Text style={styles.infoPillText}>{data.releaseYear}</Text>
              </View>
            </View>
          )}

          {/* Synopsis */}
          {data.synopsis ? (
            <View style={styles.synopsisContainer}>
              <Text style={styles.sectionTitle}>Sinopsis</Text>
              <Text style={styles.synopsisText}>{data.synopsis}</Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {lastReaded && lastReaded.episode && (
              <Button
                mode="contained"
                icon="book-open"
                style={styles.primaryButton}
                onPress={() => readComic(lastReaded.link, lastReaded)}>
                Lanjut ({lastReaded.episode})
              </Button>
            )}
            <View style={styles.secondaryButtons}>
              <Button
                mode="outlined"
                style={styles.halfButton}
                onPress={() => {
                  const chapterData = data.chapters[data.chapters.length - 1];
                  if (!chapterData?.chapterUrl) {
                    ToastAndroid.show('Chapter tidak ditemukan', ToastAndroid.SHORT);
                    return;
                  }
                  readComic(chapterData.chapterUrl);
                }}>
                Ch. Pertama
              </Button>
              <Button
                mode="outlined"
                style={styles.halfButton}
                onPress={() => {
                  const chapterData = data.chapters[0];
                  if (!chapterData?.chapterUrl) {
                    ToastAndroid.show('Chapter tidak ditemukan', ToastAndroid.SHORT);
                    return;
                  }
                  readComic(chapterData.chapterUrl);
                }}>
                Ch. Terbaru
              </Button>
            </View>
            <Button
              mode="outlined"
              icon="playlist-plus"
              style={styles.watchLaterButton}
              disabled={isInList}
              onPress={() => {
                if (!data.chapters[data.chapters.length - 1]) {
                  ToastAndroid.show('Data chapter tidak ditemukan', ToastAndroid.SHORT);
                  return;
                }
                const lastData = data.chapters[data.chapters.length - 1];
                const watchLaterJson: watchLaterJSON = {
                  title: data.title,
                  link: link,
                  rating: 'Komik',
                  releaseYear:
                    'releaseDate' in lastData
                      ? lastData.releaseDate
                      : 'releaseYear' in data
                        ? (data.releaseYear ?? 'Data tidak tersedia')
                        : 'Data tidak tersedia',
                  thumbnailUrl: data.thumbnailUrl,
                  genre: data.genres,
                  date: Date.now(),
                  isComics: true,
                };
                controlWatchLater('add', watchLaterJson);
                ToastAndroid.show('Ditambahkan ke baca nanti', ToastAndroid.SHORT);
              }}>
              {isInList ? 'Sudah di Baca Nanti' : 'Baca Nanti'}
            </Button>
          </View>

          {/* Chapter List Header + Search */}
          <View style={styles.chapterListHeader}>
            <Text style={styles.sectionTitle}>Daftar Chapter</Text>
            <Text style={styles.chapterCount}>{data.chapters.length} Chapter</Text>
          </View>

          {/* Custom Search Bar */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={13} color="#888" />
            <TextInput
              keyboardType="number-pad"
              placeholder="Cari chapter..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="times-circle" size={13} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  },
);

interface RenderChapterItemProps {
  item: KomikuDetail['chapters'][0] | ComicsDetailTypeData['chapters'][0];
  data: Props['route']['params']['data'];
  lastReaded: HistoryJSON | undefined;
  readComic: (url: string, fromHistory?: HistoryJSON) => void;
}

const RenderChapterItem = memo(({ item, data, lastReaded, readComic }: RenderChapterItemProps) => {
  const styles = useStyles();
  const theme = useTheme();

  if (!item) return null;
  let isLastReaded =
    lastReaded &&
    lastReaded.episode &&
    item.chapter
      .toLowerCase()
      .replace('indonesianTitle' in data ? 'chapter 0' : '', '')
      .replace(item.chapterUrl.includes('softkomik') ? /^0+/ : '', '')
      .replace('chapter ', '')
      .trim() ===
      lastReaded.episode
        .toLowerCase()
        .replace('indonesianTitle' in data ? 'chapter 0' : '', '')
        .replace(lastReaded.link.includes('softkomik') ? 'chapter 00' : '', '')
        .replace('chapter ', '')
        .replace(lastReaded.link.includes('softkomik') ? /^0+/ : '', '')
        .trim();
  if (!isLastReaded) {
    lastReaded?.link === item.chapterUrl && (isLastReaded = true);
  }

  return (
    <TouchableOpacity
      style={[styles.chapterItem, isLastReaded && styles.lastReadedItem]}
      onPress={() => readComic(item.chapterUrl, isLastReaded ? lastReaded : undefined)}>
      <View style={styles.chapterTitleContainer}>
        <Text style={[styles.chapterText, isLastReaded && { color: theme.colors.primary }]}>
          {item.chapter.includes('Chapter') ? item.chapter : `Chapter ${item.chapter}`}
        </Text>
        {isLastReaded && (
          <Text style={styles.lastReadedTag}>● Terakhir Dibaca</Text>
        )}
      </View>
      <View style={styles.chapterDetailsContainer}>
        {'releaseDate' in item && (
          <>
            <Text style={styles.chapterDetailText}>
              <Icon name="calendar" size={11} color={styles.chapterDetailText.color} />{' '}
              {item.releaseDate}
            </Text>
            <Text style={styles.chapterDetailText}>
              <Icon name="eye" size={11} color={styles.chapterDetailText.color} /> {item.views}x
            </Text>
          </>
        )}
      </View>
      <Icon
        name={isLastReaded ? 'history' : 'chevron-right'}
        size={18}
        color={isLastReaded ? theme.colors.primary : '#888'}
      />
    </TouchableOpacity>
  );
});

function useStyles() {
  const theme = useTheme();
  const globalStyles = useGlobalStyles();
  const colorScheme = useColorScheme();
  const dimensions = useWindowDimensions();
  const isDark = colorScheme === 'dark';

  return useMemo(
    () =>
      StyleSheet.create({
        mainContainer: {
          flex: 1,
          backgroundColor: isDark ? '#0c0c0c' : '#ebebeb',
        },
        mainContent: {
          paddingHorizontal: 16,
          paddingTop: 12,
          gap: 16,
        },
        posterRow: {
          flexDirection: 'row',
          gap: 14,
          marginTop: -60,
        },
        thumbnail: {
          width: dimensions.width * 0.28,
          height: 150,
          borderRadius: 12,
          elevation: 6,
        },
        infoContainer: {
          flex: 1,
          gap: 6,
          paddingTop: 8,
        },
        title: {
          fontSize: 18,
          fontWeight: 'bold',
          color: globalStyles.text.color,
          lineHeight: 24,
        },
        altTitle: {
          fontSize: 12,
          color: isDark ? '#aaa' : '#777',
        },
        badgeRow: {
          flexDirection: 'row',
          gap: 6,
          flexWrap: 'wrap',
        },
        badge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
        },
        badgeText: {
          fontSize: 11,
          fontWeight: 'bold',
          color: isDark ? 'white' : 'black',
        },
        author: {
          fontSize: 12,
          color: isDark ? '#5ddfff' : '#00608d',
        },
        genreContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        },
        genreChip: {
          backgroundColor: theme.colors.secondaryContainer,
          height: 28,
        },
        genreText: {
          fontSize: 11,
          color: theme.colors.onSecondaryContainer,
        },
        additionalInfo: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        infoPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: theme.colors.secondaryContainer,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 20,
        },
        infoPillText: {
          fontSize: 12,
          fontWeight: 'bold',
          color: theme.colors.onSecondaryContainer,
        },
        synopsisContainer: {
          gap: 6,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: globalStyles.text.color,
        },
        synopsisText: {
          fontSize: 14,
          lineHeight: 22,
          color: isDark ? '#ccc' : '#555',
        },
        actionButtons: {
          gap: 10,
        },
        primaryButton: {
          borderRadius: 10,
        },
        secondaryButtons: {
          flexDirection: 'row',
          gap: 10,
        },
        halfButton: {
          flex: 1,
          borderRadius: 10,
        },
        watchLaterButton: {
          borderRadius: 10,
        },
        chapterListHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 4,
        },
        chapterCount: {
          fontSize: 13,
          color: isDark ? '#888' : '#999',
        },
        searchContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? '#1e1e1e' : '#e0e0e0',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginBottom: 4,
          gap: 8,
          borderWidth: 1,
          borderColor: isDark ? '#2e2e2e' : '#ccc',
        },
        searchInput: {
          flex: 1,
          fontSize: 13,
          color: isDark ? '#e0e0e0' : '#333',
          padding: 0,
        },
        chapterItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          gap: 10,
        },
        lastReadedItem: {
          backgroundColor: isDark ? '#1a2a1a' : '#f0fff0',
        },
        chapterTitleContainer: {
          flex: 1,
        },
        chapterText: {
          fontSize: 14,
          fontWeight: '600',
          color: isDark ? '#e0e0e0' : '#333',
        },
        lastReadedTag: {
          fontSize: 10,
          fontWeight: 'bold',
          color: theme.colors.primary,
          marginTop: 2,
        },
        chapterDetailsContainer: {
          alignItems: 'flex-end',
          gap: 2,
        },
        chapterDetailText: {
          fontSize: 11,
          color: isDark ? '#aaa' : '#888',
        },
        lastReadedText: {
          color: theme.colors.onPrimaryContainer,
          fontWeight: 'bold',
        },
        chapterDivider: {
          backgroundColor: isDark ? '#2b2b2b' : '#e0e0e0',
          height: 0.8,
        },
      }),
    [
      isDark,
      colorScheme,
      dimensions.width,
      globalStyles.text.color,
      theme.colors.onPrimaryContainer,
      theme.colors.onSecondaryContainer,
      theme.colors.secondaryContainer,
      theme.colors.primary,
    ],
  );
}
