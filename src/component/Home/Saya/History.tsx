import FontAwesomeIcon from '@react-native-vector-icons/fontawesome';
import Icon from '@react-native-vector-icons/material-design-icons';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import {
  FlashList,
  FlashListRef,
  ListRenderItemInfo,
  useRecyclingState,
} from '@shopify/flash-list';
import moment from 'moment';
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, {
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import URL from 'url';

import { HistoryItemKey } from '@/types/databaseTarget';
import { HistoryJSON } from '@/types/historyJSON';
import { SayaDrawerNavigator } from '@/types/navigation';
import useGlobalStyles, { darkText } from '@assets/style';
import ImageLoading from '@component/misc/ImageLoading';
import { DatabaseManager, useModifiedKeyValueIfFocused } from '@utils/DatabaseManager';
import DialogManager from '@utils/dialogManager';

export const HistoryDatabaseCache = new Map<HistoryItemKey, HistoryJSON>();

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList as typeof FlashList<HistoryItemKey>,
);

type Props = DrawerScreenProps<SayaDrawerNavigator, 'History'>;

function History(props: Props) {
  const styles = useStyles();
  const globalStyles = useGlobalStyles();
  const theme = useTheme();
  const data = useModifiedKeyValueIfFocused(
    'historyKeyCollectionsOrder',
    state => JSON.parse(state) as HistoryItemKey[],
  );

  const [searchKeyword, setSearchKeyword] = useState('');
  const searchKeywordDeferred = useDeferredValue(searchKeyword);

  const filteredData = useMemo(
    () =>
      data.filter(item =>
        item
          .split(':')
          .slice(1, -2)
          .join(':')
          .toLowerCase()
          .includes(searchKeywordDeferred.toLowerCase()),
      ),
    [searchKeywordDeferred, data],
  );
  const flatListRef = useRef<FlashListRef<HistoryItemKey>>(null);

  const scrollLastValue = useSharedValue(0);
  const scrollToTopButtonState = useSharedValue<'hide' | 'show'>('hide');
  const scrollToTopButtonScale = useSharedValue(0);

  const scrollToTopButtonProps = useAnimatedProps(() => ({
    pointerEvents: scrollToTopButtonScale.get() <= 0.3 ? ('none' as const) : ('auto' as const),
  }));
  const buttonTransformStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scrollToTopButtonScale.get() }],
  }));

  const showScrollToTopButton = useCallback(() => {
    'worklet';
    scrollToTopButtonScale.set(withSpring(1));
  }, [scrollToTopButtonScale]);

  const hideScrollToTopButton = useCallback(() => {
    'worklet';
    scrollToTopButtonScale.set(withSpring(0));
  }, [scrollToTopButtonScale]);

  const scrollHandler = useAnimatedScrollHandler(
    event => {
      const value = event.contentOffset.y;
      if (value <= 100) {
        if (scrollToTopButtonState.get() === 'show') hideScrollToTopButton();
        scrollToTopButtonState.set('hide');
      } else if (value < scrollLastValue.get() && scrollToTopButtonState.get() === 'hide') {
        showScrollToTopButton();
        scrollToTopButtonState.set('show');
      } else if (value > scrollLastValue.get() && scrollToTopButtonState.get() === 'show') {
        hideScrollToTopButton();
        scrollToTopButtonState.set('hide');
      }
      scrollLastValue.set(value);
    },
    [hideScrollToTopButton, scrollLastValue, scrollToTopButtonState, showScrollToTopButton],
  );

  const deleteHistory = useCallback(async (key: HistoryItemKey) => {
    const keyOrder: HistoryItemKey[] = JSON.parse(
      DatabaseManager.getSync('historyKeyCollectionsOrder') ?? '[]',
    );
    const keyIndex = keyOrder.findIndex(z => z === key);
    if (keyIndex !== -1) {
      keyOrder.splice(keyIndex, 1);
      DatabaseManager.set('historyKeyCollectionsOrder', JSON.stringify(keyOrder));
      DatabaseManager.delete(key);
      HistoryDatabaseCache.delete(key);
    }
  }, []);

  const keyExtractor = useCallback((item: HistoryItemKey) => item, []);

  const renderFlatList = useCallback(
    ({ item }: ListRenderItemInfo<HistoryItemKey>) => (
      <RenderList
        keyItem={item}
        deleteHistory={deleteHistory}
        globalStyles={globalStyles}
        props={props}
        styles={styles}
      />
    ),
    [deleteHistory, globalStyles, props, styles],
  );

  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ animated: true, offset: 0 });
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Search Bar */}
      <View style={styles.searchInputView}>
        <Icon name="magnify" size={20} color={globalStyles.text.color} style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari judul anime..."
          placeholderTextColor={globalStyles.text.color + '88'}
          value={searchKeyword}
          onChangeText={setSearchKeyword}
        />
        {searchKeyword !== searchKeywordDeferred && (
          <ActivityIndicator size="small" color={globalStyles.text.color} style={{ marginRight: 6 }} />
        )}
        {searchKeyword.length > 0 && (
          <TouchableOpacity onPress={() => setSearchKeyword('')} hitSlop={8}>
            <Icon name="close-circle" size={20} color={globalStyles.text.color + '99'} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.historyContainer}>
        <AnimatedFlashList
          data={filteredData}
          key={searchKeywordDeferred}
          ref={flatListRef}
          keyExtractor={keyExtractor}
          onScroll={scrollHandler}
          removeClippedSubviews={true}
          extraData={styles}
          renderItem={renderFlatList}
          estimatedItemSize={120}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
          ListHeaderComponent={() =>
            data.length > 0 ? (
              <View style={{ paddingVertical: 10 }}>
                {searchKeywordDeferred !== '' && (
                  <Text style={[globalStyles.text, styles.searchKeywordText]}>
                    Hasil pencarian: "{searchKeywordDeferred}" ({filteredData.length})
                  </Text>
                )}
                <Text style={[globalStyles.text, styles.countText]}>
                  Histori tontonan:{' '}
                  <Text style={{ fontWeight: 'bold' }}>{data.length}</Text>
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={() => (
            <View style={styles.noHistory}>
              <Icon name="history" size={48} color={globalStyles.text.color + '44'} />
              <Text style={[globalStyles.text, { marginTop: 12, opacity: 0.5 }]}>
                Tidak ada histori tontonan
              </Text>
            </View>
          )}
        />

        <Animated.View
          style={[styles.scrollToTopView, buttonTransformStyle]}
          animatedProps={scrollToTopButtonProps}>
          <TouchableOpacity style={styles.scrollToTop} onPress={scrollToTop}>
            <View style={styles.scrollToTopIcon}>
              <Icon name="arrow-up" color={darkText} size={25} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const RenderList = memo(function RenderList({
  keyItem,
  styles,
  globalStyles,
  props,
  deleteHistory,
}: {
  keyItem: HistoryItemKey;
  props: Props;
  styles: ReturnType<typeof useStyles>;
  globalStyles: ReturnType<typeof useGlobalStyles>;
  deleteHistory: (key: HistoryItemKey) => Promise<void>;
}) {
  const theme = useTheme();
  const currentItem = useRef(keyItem);
  currentItem.current = keyItem;
  const [item, setItem] = useRecyclingState<HistoryJSON | undefined>(
    () => HistoryDatabaseCache.get(keyItem),
    [keyItem],
  );

  useFocusEffect(
    useCallback(() => {
      DatabaseManager.get(keyItem).then(value => {
        if (currentItem.current !== keyItem) return;
        const historyDb = JSON.parse(value ?? '{}');
        HistoryDatabaseCache.set(keyItem, historyDb);
        setItem(historyDb);
      });
    }, [keyItem, setItem]),
  );

  // Badge config
  const badgeConfig = useMemo(() => {
    if (item?.isComics) return { label: 'Komik', color: '#0288D1', icon: 'book-open-variant' };
    if (item?.isMovie) return { label: 'Movie', color: '#E64A19', icon: 'movie-open' };
    return null;
  }, [item?.isComics, item?.isMovie]);

  return (
    <TouchableOpacity
      style={styles.card}
      disabled={!item}
      activeOpacity={0.75}
      onPress={() => {
        props.navigation.dispatch(
          StackActions.push('FromUrl', {
            title: item?.title,
            link: item?.link,
            historyData: item,
            type: URL.parse(item?.link ?? '').hostname!?.includes('idlix')
              ? 'film'
              : item?.isMovie
                ? 'movie'
                : item?.isComics
                  ? 'comics'
                  : 'anime',
          }),
        );
      }}>
      {/* Thumbnail */}
      <View style={styles.thumbnailWrapper}>
        <ImageLoading
          resizeMode="cover"
          source={{ uri: item?.thumbnailUrl }}
          style={styles.thumbnail}
        />
        {/* Badge di atas thumbnail */}
        {badgeConfig && (
          <View style={[styles.thumbnailBadge, { backgroundColor: badgeConfig.color }]}>
            <Icon name={badgeConfig.icon} size={10} color="#fff" />
            <Text style={styles.thumbnailBadgeText}>{badgeConfig.label}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        {/* Tanggal + Hapus */}
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.timeAgo}>
              {item?.date &&
                moment.duration(moment(Date.now()).diff(item.date, 'seconds'), 'seconds').humanize() + ' yang lalu'}
            </Text>
            <Text style={styles.dateText}>
              {item?.date && moment(item.date).format('DD MMMM YYYY [pukul] HH:mm')}
            </Text>
          </View>
          <TouchableOpacity
            disabled={!item}
            style={styles.deleteButton}
            hitSlop={6}
            onPress={() => {
              DialogManager.alert(
                'Hapus Histori',
                `Yakin ingin menghapus "${item?.title?.trim()}" dari histori?`,
                [
                  { text: 'Batal', onPress: () => null },
                  { text: 'Hapus', onPress: () => deleteHistory(keyItem) },
                ],
              );
            }}>
            <Icon name="delete-forever" size={20} style={styles.deleteIcon} />
          </TouchableOpacity>
        </View>

        {/* Judul */}
        <Text style={[globalStyles.text, styles.title]} numberOfLines={2}>
          {item?.title}
        </Text>

        {/* Episode + Durasi */}
        <View style={styles.bottomRow}>
          <Text style={styles.episodeText} numberOfLines={1}>
            {item?.episode}
          </Text>
          {item?.lastDuration !== undefined && (
            <View style={styles.durationBadge}>
              <Icon
                name={item?.isComics ? 'book-open-page-variant' : 'clock-outline'}
                size={12}
                color={theme.colors.primary}
              />
              <Text style={[styles.durationText, { color: theme.colors.primary }]}>
                {item?.isComics
                  ? 'Hal. ' + (item.lastDuration + 1)
                  : formatTimeFromSeconds(item.lastDuration)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

function formatTimeFromSeconds(seconds: number) {
  const duration = moment.duration(seconds, 'seconds');
  const h = duration.hours().toString().padStart(2, '0');
  const m = duration.minutes().toString().padStart(2, '0');
  const s = duration.seconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function useStyles() {
  const theme = useTheme();
  const globalStyles = useGlobalStyles();
  const isDark = theme.dark;

  return useMemo(
    () =>
      StyleSheet.create({
        historyContainer: {
          overflow: 'hidden',
          flex: 1,
        },
        countText: {
          fontSize: 13,
          opacity: 0.7,
        },
        // Search
        searchInputView: {
          flexDirection: 'row',
          alignItems: 'center',
          height: 44,
          borderRadius: 12,
          marginHorizontal: 12,
          marginTop: 10,
          marginBottom: 4,
          paddingHorizontal: 12,
          backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0',
          borderWidth: 1,
          borderColor: isDark ? '#333' : '#e0e0e0',
        },
        searchInput: {
          color: globalStyles.text.color,
          flex: 1,
          fontSize: 14,
        },
        searchKeywordText: {
          opacity: 0.7,
          fontStyle: 'italic',
          fontSize: 12,
          marginBottom: 4,
        },
        // Card
        card: {
          flexDirection: 'row',
          marginVertical: 5,
          backgroundColor: theme.colors.surface,
          borderRadius: 14,
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: isDark ? '#2a2a2a' : '#e8e8e8',
        },
        thumbnailWrapper: {
          position: 'relative',
        },
        thumbnail: {
          width: 85,
          height: 120,
        },
        thumbnailBadge: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          paddingVertical: 3,
        },
        thumbnailBadgeText: {
          color: '#fff',
          fontSize: 10,
          fontWeight: 'bold',
        },
        infoContainer: {
          flex: 1,
          paddingHorizontal: 10,
          paddingVertical: 8,
          justifyContent: 'space-between',
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
        },
        timeAgo: {
          fontSize: 11,
          fontWeight: '700',
          color: theme.colors.primary,
        },
        dateText: {
          fontSize: 11,
          color: isDark ? '#888' : '#999',
          marginTop: 1,
        },
        deleteButton: {
          backgroundColor: theme.colors.errorContainer,
          borderRadius: 8,
          padding: 4,
        },
        deleteIcon: {
          color: theme.colors.onErrorContainer,
        },
        title: {
          fontSize: 13,
          fontWeight: '600',
          lineHeight: 18,
          flex: 1,
        },
        bottomRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        },
        episodeText: {
          fontSize: 12,
          color: isDark ? '#aaa' : '#666',
          flex: 1,
        },
        durationBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          backgroundColor: isDark ? '#1a1a2e' : '#ede9fe',
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: 20,
        },
        durationText: {
          fontSize: 11,
          fontWeight: '600',
        },
        noHistory: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 80,
        },
        // Scroll to top
        scrollToTopView: {
          position: 'absolute',
          bottom: 40,
          right: 10,
          zIndex: 1,
        },
        scrollToTop: {
          height: 50,
          width: 50,
          borderRadius: 100,
          backgroundColor: 'rgb(0, 47, 109)',
          elevation: 3,
          shadowColor: 'white',
        },
        scrollToTopIcon: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [globalStyles.text.color, theme, isDark],
  );
}

export default memo(History);
