import useGlobalStyles from '@assets/style';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Markdown from 'react-native-marked';
import { Button, Modal, Portal, useTheme } from 'react-native-paper';
import Icon from '@react-native-vector-icons/material-design-icons';

export default function Announcement() {
  const [modalVisible, setModalVisible] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');

  const dimensions = useWindowDimensions();
  const globalStyles = useGlobalStyles();
  const styles = useStyles();
  const theme = useTheme();

  useEffect(() => {
    fetch(
      'https://raw.githubusercontent.com/hiuraaaaa/AniFlix/refs/heads/master/Announcement.md',
    )
      .then(async data => {
        if (!data.ok) return;
        const text = await data.text();
        if (text.trim() === '') return;
        setAnnouncementText(text);
        setModalVisible(true);
      })
      .catch(() => {});
  }, []);

  return (
    <Portal>
      <Modal
        visible={modalVisible}
        contentContainerStyle={{ flex: 1 }}
        onDismiss={() => setModalVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>

            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconWrapper, { backgroundColor: theme.colors.primaryContainer }]}>
                <Icon name="bullhorn" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[globalStyles.text, styles.headerText]}>
                Pemberitahuan
              </Text>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

            {/* Content */}
            <View style={styles.content}>
              <Markdown
                flatListProps={{
                  style: {
                    backgroundColor: 'transparent',
                    maxHeight: dimensions.height * 0.55,
                  },
                }}
                value={announcementText}
              />
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

            {/* Footer */}
            <View style={styles.footer}>
              <Button
                mode="contained"
                icon="close"
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}>
                Tutup
              </Button>
            </View>

          </View>
        </View>
      </Modal>
    </Portal>
  );
}

function useStyles() {
  const theme = useTheme();
  const isDark = theme.dark;

  return useMemo(() => {
    return StyleSheet.create({
      backdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      },
      card: {
        width: '88%',
        backgroundColor: theme.colors.elevation.level2,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
      },
      iconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
      },
      headerText: {
        fontSize: 17,
        fontWeight: 'bold',
        flex: 1,
      },
      divider: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: 0,
      },
      content: {
        paddingHorizontal: 16,
        paddingVertical: 12,
      },
      footer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'flex-end',
      },
      closeButton: {
        borderRadius: 10,
        minWidth: 100,
      },
    });
  }, [theme]);
}
