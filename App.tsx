import "react-native-gesture-handler";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  NativeStackScreenProps,
  createNativeStackNavigator,
} from "@react-navigation/native-stack";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

type TransactionType = "expense" | "income";

type Category = {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
};

type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note: string;
  date: string;
  account: string;
  images: string[];
};

type AppData = {
  profile: {
    name: string;
    initials: string;
  };
  categories: Category[];
  transactions: Transaction[];
  currency: string;
  requirePinOnResume: boolean;
  isPremium: boolean;
};

type RootStackParamList = {
  Tabs: undefined;
  TransactionEditor: { transactionId?: string; defaultType?: TransactionType } | undefined;
  TransactionDetail: { transactionId: string };
  Categories: undefined;
  ChangePin: undefined;
};

type TabParamList = {
  Overview: undefined;
  Calendar: undefined;
  Entry: undefined;
  Reports: undefined;
  More: undefined;
};

const STORAGE_KEY = "thu_chi_app_data_v1";
const PIN_KEY = "thu_chi_pin_v1";
const ACCOUNTS = ["Tiền mặt", "Ngân hàng", "Ví điện tử"];

const COLORS = {
  background: "#131315",
  backgroundAlt: "#0E0E10",
  surface: "#1B1B1D",
  surface2: "#1F1F21",
  surface3: "#2A2A2C",
  border: "rgba(255,255,255,0.12)",
  text: "#E4E2E4",
  muted: "#AEB4C2",
  primary: "#ADC6FF",
  primaryStrong: "#4B8EFF",
  income: "#79B5FF",
  expense: "#FFB868",
  error: "#FF8E85",
  success: "#7CD992",
  gold: "#D4AF37",
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: "c1", name: "Ăn uống", type: "expense", icon: "restaurant", color: "#FA9B00" },
  { id: "c2", name: "Mua sắm", type: "expense", icon: "bag-handle", color: "#FF7A7A" },
  { id: "c3", name: "Di chuyển", type: "expense", icon: "car-sport", color: "#8CB6FF" },
  { id: "c4", name: "Nhà cửa", type: "expense", icon: "home", color: "#C2A4FF" },
  { id: "c5", name: "Giải trí", type: "expense", icon: "game-controller", color: "#6CE2D9" },
  { id: "c6", name: "Khác", type: "expense", icon: "ellipsis-horizontal-circle", color: "#AEB4C2" },
  { id: "c7", name: "Lương", type: "income", icon: "wallet", color: "#79B5FF" },
  { id: "c8", name: "Thưởng", type: "income", icon: "trophy", color: "#D4AF37" },
  { id: "c9", name: "Đầu tư", type: "income", icon: "trending-up", color: "#7CD992" },
  { id: "c10", name: "Thu khác", type: "income", icon: "cash", color: "#AEB4C2" },
];

const TODAY = new Date();

const DEFAULT_TRANSACTIONS: Transaction[] = [
  createTransaction("expense", 250000, "c1", "Ăn tối cùng khách hàng", offsetDate(-0), "Tiền mặt", []),
  createTransaction("income", 18500000, "c7", "Nhận lương tháng", offsetDate(-2), "Ngân hàng", []),
  createTransaction("expense", 420000, "c3", "Đổ xăng và gửi xe", offsetDate(-1), "Ví điện tử", []),
  createTransaction("expense", 890000, "c2", "Mua đồ dùng cá nhân", offsetDate(-4), "Ngân hàng", []),
  createTransaction("income", 2500000, "c9", "Lợi nhuận đầu tư", offsetDate(-8), "Ngân hàng", []),
  createTransaction("expense", 3200000, "c4", "Thanh toán tiền nhà", offsetDate(-11), "Ngân hàng", []),
];

const INITIAL_DATA: AppData = {
  profile: {
    name: "Nguyễn Văn A",
    initials: "NA",
  },
  categories: DEFAULT_CATEGORIES,
  transactions: DEFAULT_TRANSACTIONS,
  currency: "VND",
  requirePinOnResume: true,
  isPremium: false,
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [booting, setBooting] = useState(true);
  const [pin, setPin] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const appState = useRef(AppState.currentState);
  const relockOnActive = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const savedPin = await SecureStore.getItemAsync(PIN_KEY);

        if (saved) {
          setData(normalizeData(JSON.parse(saved) as Partial<AppData>));
        }

        if (savedPin) {
          setPin(savedPin);
          setLocked(true);
        } else {
          setLocked(true);
        }
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (booting) {
      return;
    }

    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [booting, data]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        data.requirePinOnResume &&
        pin &&
        (nextState === "inactive" || nextState === "background")
      ) {
        relockOnActive.current = true;
      }

      if (
        nextState === "active" &&
        relockOnActive.current &&
        data.requirePinOnResume &&
        pin
      ) {
        setLocked(true);
        relockOnActive.current = false;
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [data.requirePinOnResume, pin]);

  const categoriesById = Object.fromEntries(data.categories.map((item) => [item.id, item]));

  const saveTransaction = (payload: Omit<Transaction, "id"> & { id?: string }) => {
    const next: Transaction = {
      ...payload,
      id: payload.id ?? `tx_${Date.now()}_${Math.round(Math.random() * 1000)}`,
    };

    setData((current) => {
      const exists = current.transactions.some((item) => item.id === next.id);
      const transactions = exists
        ? current.transactions.map((item) => (item.id === next.id ? next : item))
        : [next, ...current.transactions];

      return {
        ...current,
        transactions: sortTransactions(transactions),
      };
    });
  };

  const deleteTransaction = (transactionId: string) => {
    setData((current) => ({
      ...current,
      transactions: current.transactions.filter((item) => item.id !== transactionId),
    }));
  };

  const saveCategory = (input: Omit<Category, "id"> & { id?: string }) => {
    const next: Category = {
      ...input,
      id: input.id ?? `cat_${Date.now()}_${Math.round(Math.random() * 1000)}`,
    };

    setData((current) => {
      const exists = current.categories.some((item) => item.id === next.id);
      return {
        ...current,
        categories: exists
          ? current.categories.map((item) => (item.id === next.id ? next : item))
          : [...current.categories, next],
      };
    });
  };

  const deleteCategory = (categoryId: string) => {
    const linked = data.transactions.some((item) => item.categoryId === categoryId);
    if (linked) {
      Alert.alert("Không thể xóa", "Danh mục này đang được dùng trong giao dịch.");
      return;
    }

    setData((current) => ({
      ...current,
      categories: current.categories.filter((item) => item.id !== categoryId),
    }));
  };

  const exportCsv = async () => {
    try {
      const csv = toCsv(data.transactions, data.categories);
      const fileUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}thu-chi-${dateStamp()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Xuất dữ liệu CSV",
        });
      } else {
        Alert.alert("Đã tạo file", fileUri);
      }
    } catch (error) {
      Alert.alert("Xuất CSV thất bại", "Không thể tạo file CSV.");
    }
  };

  const importCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel"],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      const content = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const { importedTransactions, importedCategories } = fromCsv(content, data.categories);

      setData((current) => ({
        ...current,
        categories: importedCategories,
        transactions: sortTransactions([...importedTransactions, ...current.transactions]),
      }));

      Alert.alert("Nhập CSV thành công", `Đã thêm ${importedTransactions.length} giao dịch.`);
    } catch (error) {
      Alert.alert("Nhập CSV thất bại", "File CSV không đúng định dạng.");
    }
  };

  const setOrChangePin = async (nextPin: string) => {
    await SecureStore.setItemAsync(PIN_KEY, nextPin);
    setPin(nextPin);
    setLocked(false);
  };

  const clearPin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    setPin(null);
    setLocked(false);
  };

  if (booting) {
    return (
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaProvider>
          <View style={styles.splash}>
            <Text style={styles.splashTitle}>Sổ Thu Chi</Text>
            <Text style={styles.splashText}>Đang tải dữ liệu...</Text>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RNStatusBar barStyle="light-content" />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
            }}
          >
            <Stack.Screen name="Tabs">
              {() => (
                <TabsShell
                  data={data}
                  categoriesById={categoriesById}
                  saveTransaction={saveTransaction}
                  saveCategory={saveCategory}
                  deleteCategory={deleteCategory}
                  exportCsv={exportCsv}
                  importCsv={importCsv}
                  setData={setData}
                  clearPin={clearPin}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="TransactionEditor">
              {(props) => (
                <TransactionEditorScreen
                  {...props}
                  data={data}
                  saveTransaction={saveTransaction}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="TransactionDetail">
              {(props) => (
                <TransactionDetailScreen
                  {...props}
                  data={data}
                  categoriesById={categoriesById}
                  deleteTransaction={deleteTransaction}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Categories">
              {(props) => (
                <CategoriesScreen
                  {...props}
                  categories={data.categories}
                  saveCategory={saveCategory}
                  deleteCategory={deleteCategory}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="ChangePin">
              {(props) => (
                <ChangePinScreen
                  {...props}
                  clearPin={clearPin}
                  setOrChangePin={setOrChangePin}
                />
              )}
            </Stack.Screen>
          </Stack.Navigator>

          <PinGate
            visible={locked}
            existingPin={pin}
            onUnlock={() => setLocked(false)}
            onSetPin={setOrChangePin}
          />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function TabsShell({
  data,
  categoriesById,
  saveTransaction,
  saveCategory,
  deleteCategory,
  exportCsv,
  importCsv,
  setData,
  clearPin,
}: {
  data: AppData;
  categoriesById: Record<string, Category>;
  saveTransaction: (payload: Omit<Transaction, "id"> & { id?: string }) => void;
  saveCategory: (payload: Omit<Category, "id"> & { id?: string }) => void;
  deleteCategory: (categoryId: string) => void;
  exportCsv: () => Promise<void>;
  importCsv: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  clearPin: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 74 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ],
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
      }}
    >
      <Tab.Screen
        name="Overview"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="Tổng quan" icon="grid" color={color} focused={focused} />
          ),
        }}
      >
        {() => (
          <OverviewScreen
            data={data}
            categoriesById={categoriesById}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Calendar"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="Lịch" icon="calendar" color={color} focused={focused} />
          ),
        }}
      >
        {() => <CalendarScreen data={data} categoriesById={categoriesById} />}
      </Tab.Screen>
      <Tab.Screen
        name="Entry"
        options={{
          tabBarIcon: ({ focused }) => (
            <LinearGradient
              colors={focused ? [COLORS.primaryStrong, COLORS.primary] : [COLORS.surface3, COLORS.surface2]}
              style={styles.entryTab}
            >
              <Ionicons name="add" size={22} color={focused ? "#07162F" : COLORS.text} />
              <Text style={[styles.entryTabLabel, focused && { color: "#07162F" }]}>Nhập vào</Text>
            </LinearGradient>
          ),
        }}
      >
        {() => <TransactionEntryTab data={data} saveTransaction={saveTransaction} />}
      </Tab.Screen>
      <Tab.Screen
        name="Reports"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="Báo cáo" icon="stats-chart" color={color} focused={focused} />
          ),
        }}
      >
        {() => <ReportsScreen data={data} categoriesById={categoriesById} />}
      </Tab.Screen>
      <Tab.Screen
        name="More"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="Khác" icon="ellipsis-horizontal" color={color} focused={focused} />
          ),
        }}
      >
        {() => (
          <MoreScreen
            data={data}
            saveCategory={saveCategory}
            deleteCategory={deleteCategory}
            exportCsv={exportCsv}
            importCsv={importCsv}
            setData={setData}
            clearPin={clearPin}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function OverviewScreen({
  data,
  categoriesById,
}: {
  data: AppData;
  categoriesById: Record<string, Category>;
}) {
  const navigation = useNavigation<any>();
  const totals = getTotals(data.transactions);
  const monthTransactions = data.transactions.filter((item) => sameMonth(new Date(item.date), TODAY));
  const trend = buildDailyTrend(monthTransactions);

  return (
    <Screen title="Tổng quan hôm nay" subtitle="Sổ Thu Chi" profile={data.profile}>
      <View style={styles.balanceBlock}>
        <Text style={styles.sectionLabel}>Tổng số dư hiện tại</Text>
        <Text style={styles.balanceValue}>{formatCurrency(totals.balance)}</Text>
        <Text style={styles.balanceMeta}>
          Thu {formatCompact(totals.income)} · Chi {formatCompact(totals.expense)}
        </Text>
      </View>

      <GlassCard>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Chi tiêu 7 ngày gần nhất</Text>
          <Ionicons name="analytics" size={18} color={COLORS.primary} />
        </View>
        <View style={styles.chartRow}>
          {trend.map((item) => {
            const ratio = trendMax(trend) === 0 ? 0.1 : item.value / trendMax(trend);
            return (
              <View key={item.key} style={styles.chartColumn}>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: Math.max(10, ratio * 108),
                        backgroundColor: item.value > 0 ? COLORS.primary : "rgba(255,255,255,0.08)",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.chartLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </GlassCard>

      <View style={styles.statsGrid}>
        <MetricCard label="Thu nhập tháng" value={formatCurrency(sumByType(monthTransactions, "income"))} accent={COLORS.income} icon="arrow-down" />
        <MetricCard label="Chi tiêu tháng" value={formatCurrency(sumByType(monthTransactions, "expense"))} accent={COLORS.expense} icon="arrow-up" />
      </View>

      <GlassCard>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Giao dịch gần đây</Text>
          <Pressable onPress={() => navigation.navigate("Calendar")}>
            <Text style={styles.linkText}>Xem tất cả</Text>
          </Pressable>
        </View>

        {data.transactions.slice(0, 5).map((item) => (
          <Pressable
            key={item.id}
            style={styles.transactionRow}
            onPress={() => navigation.navigate("TransactionDetail", { transactionId: item.id })}
          >
            <CategoryIcon category={categoriesById[item.categoryId]} />
            <View style={styles.transactionTextBlock}>
              <Text style={styles.transactionTitle}>{categoriesById[item.categoryId]?.name ?? "Danh mục"}</Text>
              <Text style={styles.transactionMeta}>
                {item.note || "Không có ghi chú"} · {formatDate(item.date)}
              </Text>
            </View>
            <Text style={[styles.transactionAmount, item.type === "income" ? styles.amountIncome : styles.amountExpense]}>
              {item.type === "income" ? "+" : "-"}{formatCompact(item.amount)}
            </Text>
          </Pressable>
        ))}
      </GlassCard>
    </Screen>
  );
}

function CalendarScreen({
  data,
  categoriesById,
}: {
  data: AppData;
  categoriesById: Record<string, Category>;
}) {
  const navigation = useNavigation<any>();
  const [selectedDate, setSelectedDate] = useState(startOfDay(TODAY));
  const [monthCursor, setMonthCursor] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));

  const days = buildCalendar(monthCursor, data.transactions);
  const selectedKey = isoDate(selectedDate);
  const items = data.transactions.filter((item) => isoDate(new Date(item.date)) === selectedKey);
  const changeMonth = (offset: number) => {
    const nextMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + offset, 1);
    setMonthCursor(nextMonth);
    setSelectedDate(nextMonth);
  };

  return (
    <Screen title="Lịch giao dịch" subtitle={monthLabel(monthCursor)} profile={data.profile}>
      <GlassCard>
        <View style={styles.rowBetween}>
          <IconButton icon="chevron-back" onPress={() => changeMonth(-1)} />
          <Text style={styles.cardTitle}>{monthLabel(monthCursor)}</Text>
          <IconButton icon="chevron-forward" onPress={() => changeMonth(1)} />
        </View>

        <View style={styles.weekHeader}>
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => (
            <Text key={label} style={styles.weekLabel}>{label}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {days.map((day) => {
            const active = day.inMonth && isoDate(day.date) === selectedKey;
            return (
              <Pressable
                key={`${day.date.toISOString()}_${day.inMonth}`}
                style={[styles.dayCell, !day.inMonth && styles.dayCellOutside, active && styles.dayCellActive]}
                disabled={!day.inMonth}
                onPress={() => setSelectedDate(day.date)}
              >
                <Text style={[styles.dayLabel, !day.inMonth && styles.dayLabelMuted, active && styles.dayLabelActive]}>
                  {day.inMonth ? day.date.getDate() : ""}
                </Text>
                <View style={styles.dayDots}>
                  {day.inMonth && day.income > 0 && <View style={[styles.dayDot, { backgroundColor: COLORS.income }]} />}
                  {day.inMonth && day.expense > 0 && <View style={[styles.dayDot, { backgroundColor: COLORS.expense }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Giao dịch ngày {formatDate(selectedDate.toISOString())}</Text>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có giao dịch trong ngày này.</Text>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              style={styles.transactionRow}
              onPress={() => navigation.navigate("TransactionEditor", { transactionId: item.id })}
            >
              <CategoryIcon category={categoriesById[item.categoryId]} />
              <View style={styles.transactionTextBlock}>
                <Text style={styles.transactionTitle}>{categoriesById[item.categoryId]?.name ?? "Danh mục"}</Text>
                <Text style={styles.transactionMeta}>{item.note || item.account}</Text>
              </View>
              <Text style={[styles.transactionAmount, item.type === "income" ? styles.amountIncome : styles.amountExpense]}>
                {item.type === "income" ? "+" : "-"}{formatCompact(item.amount)}
              </Text>
            </Pressable>
          ))
        )}
      </GlassCard>
    </Screen>
  );
}

function TransactionEntryTab({
  data,
  saveTransaction,
}: {
  data: AppData;
  saveTransaction: (payload: Omit<Transaction, "id"> & { id?: string }) => void;
}) {
  return (
    <Screen title="Nhập giao dịch" subtitle="Ghi nhanh thu nhập và chi tiêu" profile={data.profile}>
      <TransactionForm
        data={data}
        saveTransaction={saveTransaction}
        onSaved={() => Alert.alert("Đã lưu", "Giao dịch mới đã được thêm.")}
      />
    </Screen>
  );
}

function ReportsScreen({
  data,
  categoriesById,
}: {
  data: AppData;
  categoriesById: Record<string, Category>;
}) {
  const monthly = monthBuckets(data.transactions);
  const categorySummary = summarizeCategories(data.transactions, data.categories);
  const currentExpense = categorySummary.filter((item) => item.type === "expense").slice(0, 5);

  return (
    <Screen title="Báo cáo" subtitle="Theo dõi xu hướng chi tiêu và thu nhập" profile={data.profile}>
      <GlassCard>
        <Text style={styles.cardTitle}>6 tháng gần nhất</Text>
        <View style={styles.monthBars}>
          {monthly.map((item) => {
            const max = Math.max(...monthly.map((entry) => entry.total), 1);
            return (
              <View key={item.label} style={styles.monthBarItem}>
                <View style={styles.monthBarTrack}>
                  <View
                    style={[
                      styles.monthBar,
                      { height: Math.max(14, (item.total / max) * 120) },
                    ]}
                  />
                </View>
                <Text style={styles.chartLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Chi tiêu theo danh mục</Text>
        {currentExpense.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có dữ liệu.</Text>
        ) : (
          currentExpense.map((item) => (
            <View key={item.categoryId} style={styles.reportRow}>
              <View style={styles.reportLeft}>
                <CategoryIcon category={categoriesById[item.categoryId]} compact />
                <View>
                  <Text style={styles.transactionTitle}>{item.name}</Text>
                  <Text style={styles.transactionMeta}>{item.count} giao dịch</Text>
                </View>
              </View>
              <Text style={styles.transactionAmount}>{formatCurrency(item.total)}</Text>
            </View>
          ))
        )}
      </GlassCard>
    </Screen>
  );
}

function MoreScreen({
  data,
  exportCsv,
  importCsv,
  setData,
}: {
  data: AppData;
  saveCategory: (payload: Omit<Category, "id"> & { id?: string }) => void;
  deleteCategory: (categoryId: string) => void;
  exportCsv: () => Promise<void>;
  importCsv: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  clearPin: () => Promise<void>;
}) {
  const navigation = useNavigation<any>();
  const [premiumCode, setPremiumCode] = useState("");

  return (
    <Screen title="Khác" subtitle="Cài đặt, dữ liệu và bảo mật" profile={data.profile}>
      <GlassCard>
        <View style={styles.rowBetween}>
          <View style={styles.settingsLeft}>
            <Ionicons name="sparkles" size={20} color={COLORS.gold} />
            <View style={styles.transactionTextBlock}>
              <Text style={styles.cardTitle}>Premium</Text>
              <Text style={styles.transactionMeta}>
                {data.isPremium ? "Đã kích hoạt" : "Nhập mã để nâng cấp"}
              </Text>
            </View>
          </View>
          {data.isPremium && <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />}
        </View>
        {!data.isPremium && (
          <>
            <TextInput
              value={premiumCode}
              onChangeText={setPremiumCode}
              autoCapitalize="characters"
              placeholder="Mã Premium"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />
            <Pressable
              style={styles.primaryAction}
              onPress={() => {
                const normalized = premiumCode.trim().toUpperCase();
                if (!["PRE", "PREMIUM", "THUCHI"].includes(normalized)) {
                  Alert.alert("Mã không hợp lệ", "Vui lòng kiểm tra lại mã Premium.");
                  return;
                }

                setData((current) => ({ ...current, isPremium: true }));
                setPremiumCode("");
              }}
            >
              <Ionicons name="arrow-up-circle" size={18} color="#07162F" />
              <Text style={styles.primaryActionText}>Nâng Premium</Text>
            </Pressable>
          </>
        )}
      </GlassCard>

      <GlassCard>
        <SettingsRow label="Quản lý danh mục" icon="grid" onPress={() => navigation.navigate("Categories")} />
        <SettingsRow label="Đổi mã PIN 4 số" icon="lock-closed" onPress={() => navigation.navigate("ChangePin")} />
        <SettingsToggle
          label="Khóa lại khi quay vào app"
          icon="shield-checkmark"
          value={data.requirePinOnResume}
          onValueChange={(value) => setData((current) => ({ ...current, requirePinOnResume: value }))}
        />
      </GlassCard>

      <GlassCard>
        <SettingsRow label="Xuất dữ liệu CSV" icon="download" onPress={() => void exportCsv()} />
        <SettingsRow label="Nhập dữ liệu CSV" icon="cloud-upload" onPress={() => void importCsv()} />
      </GlassCard>
    </Screen>
  );
}

function TransactionEditorScreen({
  route,
  navigation,
  data,
  saveTransaction,
}: NativeStackScreenProps<RootStackParamList, "TransactionEditor"> & {
  data: AppData;
  saveTransaction: (payload: Omit<Transaction, "id"> & { id?: string }) => void;
}) {
  return (
    <Screen title={route.params?.transactionId ? "Chỉnh sửa giao dịch" : "Thêm giao dịch"} subtitle="Nhập thông tin giao dịch" profile={data.profile}>
      <TransactionForm
        data={data}
        saveTransaction={saveTransaction}
        transactionId={route.params?.transactionId}
        defaultType={route.params?.defaultType}
        onSaved={() => navigation.goBack()}
      />
    </Screen>
  );
}

function TransactionDetailScreen({
  route,
  navigation,
  data,
  categoriesById,
  deleteTransaction,
}: NativeStackScreenProps<RootStackParamList, "TransactionDetail"> & {
  data: AppData;
  categoriesById: Record<string, Category>;
  deleteTransaction: (transactionId: string) => void;
}) {
  const transaction = data.transactions.find((item) => item.id === route.params.transactionId);

  if (!transaction) {
    return (
      <Screen title="Chi tiết" subtitle="Không tìm thấy giao dịch" profile={data.profile}>
        <GlassCard>
          <Text style={styles.emptyText}>Giao dịch không còn tồn tại.</Text>
        </GlassCard>
      </Screen>
    );
  }

  const category = categoriesById[transaction.categoryId];

  return (
    <Screen title="Chi tiết giao dịch" subtitle={formatDate(transaction.date)} profile={data.profile}>
      <GlassCard>
        <View style={styles.detailHero}>
          <CategoryIcon category={category} large />
          <Text style={styles.detailCategory}>{category?.name ?? "Danh mục"}</Text>
          <Text style={[styles.detailAmount, transaction.type === "income" ? styles.amountIncome : styles.amountExpense]}>
            {transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
          </Text>
        </View>

        <DetailRow label="Loại giao dịch" value={transaction.type === "income" ? "Thu nhập" : "Chi tiêu"} />
        <DetailRow label="Tài khoản" value={transaction.account} />
        <DetailRow label="Ghi chú" value={transaction.note || "Không có"} />
        <DetailRow label="Ảnh hóa đơn" value={`${transaction.images.length} ảnh`} />
      </GlassCard>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.secondaryAction, { borderColor: "rgba(255,142,133,0.25)" }]}
          onPress={() =>
            Alert.alert("Xóa giao dịch", "Bạn chắc chắn muốn xóa giao dịch này?", [
              { text: "Hủy" },
              {
                text: "Xóa",
                style: "destructive",
                onPress: () => {
                  deleteTransaction(transaction.id);
                  navigation.goBack();
                },
              },
            ])
          }
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          <Text style={[styles.secondaryActionText, { color: COLORS.error }]}>Xóa</Text>
        </Pressable>

        <Pressable
          style={styles.primaryAction}
          onPress={() => navigation.navigate("TransactionEditor", { transactionId: transaction.id })}
        >
          <Ionicons name="create-outline" size={18} color="#07162F" />
          <Text style={styles.primaryActionText}>Chỉnh sửa</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function CategoriesScreen({
  navigation,
  categories,
  saveCategory,
  deleteCategory,
}: NativeStackScreenProps<RootStackParamList, "Categories"> & {
  categories: Category[];
  saveCategory: (payload: Omit<Category, "id"> & { id?: string }) => void;
  deleteCategory: (categoryId: string) => void;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [name, setName] = useState("");
  const iconOptions = type === "expense" ? ["restaurant", "cart", "car", "home", "gift"] : ["wallet", "cash", "trophy", "trending-up", "briefcase"];
  const colorOptions = type === "expense" ? ["#FA9B00", "#FF7A7A", "#8CB6FF", "#C2A4FF"] : ["#79B5FF", "#7CD992", "#D4AF37", "#AEB4C2"];
  const [icon, setIcon] = useState(iconOptions[0]);
  const [color, setColor] = useState(colorOptions[0]);

  useEffect(() => {
    setIcon(iconOptions[0]);
    setColor(colorOptions[0]);
  }, [type]);

  const filtered = categories.filter((item) => item.type === type);

  return (
    <Screen title="Quản lý danh mục" subtitle="Đồng bộ danh mục cho toàn app" profile={{ name: "", initials: "NA" }}>
      <View style={styles.segment}>
        <SegmentButton label="Chi tiêu" active={type === "expense"} onPress={() => setType("expense")} />
        <SegmentButton label="Thu nhập" active={type === "income"} onPress={() => setType("income")} />
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Tạo danh mục mới</Text>
        <TextInput
          style={styles.input}
          placeholder="Tên danh mục"
          placeholderTextColor={COLORS.muted}
          value={name}
          onChangeText={setName}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionScroller}>
          {iconOptions.map((value) => (
            <Pressable key={value} style={[styles.iconChoice, icon === value && styles.iconChoiceActive]} onPress={() => setIcon(value)}>
              <Ionicons name={value as any} size={20} color={icon === value ? "#07162F" : COLORS.text} />
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionScroller}>
          {colorOptions.map((value) => (
            <Pressable key={value} style={[styles.colorChoice, { backgroundColor: value }, color === value && styles.colorChoiceActive]} onPress={() => setColor(value)} />
          ))}
        </ScrollView>

        <Pressable
          style={styles.primaryAction}
          onPress={() => {
            if (!name.trim()) {
              Alert.alert("Thiếu tên danh mục", "Vui lòng nhập tên danh mục.");
              return;
            }

            saveCategory({ name: name.trim(), type, icon, color });
            setName("");
          }}
        >
          <Text style={styles.primaryActionText}>Thêm danh mục</Text>
        </Pressable>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Danh sách hiện có</Text>
        {filtered.map((item) => (
          <View key={item.id} style={styles.categoryRow}>
            <CategoryIcon category={item} />
            <View style={styles.transactionTextBlock}>
              <Text style={styles.transactionTitle}>{item.name}</Text>
              <Text style={styles.transactionMeta}>{item.type === "income" ? "Thu nhập" : "Chi tiêu"}</Text>
            </View>
            <Pressable onPress={() => deleteCategory(item.id)}>
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            </Pressable>
          </View>
        ))}
      </GlassCard>

      <Pressable style={styles.secondaryAction} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryActionText}>Quay lại</Text>
      </Pressable>
    </Screen>
  );
}

function ChangePinScreen({
  navigation,
  setOrChangePin,
  clearPin,
}: NativeStackScreenProps<RootStackParamList, "ChangePin"> & {
  setOrChangePin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
}) {
  const [nextPin, setNextPin] = useState("");

  return (
    <Screen title="Đổi mã PIN" subtitle="Mã khóa 4 số khi mở app" profile={{ name: "", initials: "NA" }}>
      <GlassCard>
        <Text style={styles.cardTitle}>Mã PIN mới</Text>
        <TextInput
          value={nextPin}
          onChangeText={(text) => setNextPin(text.replace(/\D/g, "").slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          style={styles.pinInput}
          placeholder="••••"
          placeholderTextColor={COLORS.muted}
        />
        <Pressable
          style={styles.primaryAction}
          onPress={async () => {
            if (nextPin.length !== 4) {
              Alert.alert("PIN chưa hợp lệ", "PIN phải đủ 4 số.");
              return;
            }

            await setOrChangePin(nextPin);
            navigation.goBack();
          }}
        >
          <Text style={styles.primaryActionText}>Lưu PIN mới</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryAction}
          onPress={async () => {
            await clearPin();
            navigation.goBack();
          }}
        >
          <Text style={styles.secondaryActionText}>Gỡ mã PIN</Text>
        </Pressable>
      </GlassCard>
    </Screen>
  );
}

function TransactionForm({
  data,
  saveTransaction,
  transactionId,
  defaultType,
  onSaved,
}: {
  data: AppData;
  saveTransaction: (payload: Omit<Transaction, "id"> & { id?: string }) => void;
  transactionId?: string;
  defaultType?: TransactionType;
  onSaved: () => void;
}) {
  const existing = data.transactions.find((item) => item.id === transactionId);
  const [type, setType] = useState<TransactionType>(existing?.type ?? defaultType ?? "expense");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [categoryId, setCategoryId] = useState(
    existing?.categoryId ?? data.categories.find((item) => item.type === (existing?.type ?? defaultType ?? "expense"))?.id ?? data.categories[0]?.id
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [account, setAccount] = useState(existing?.account ?? ACCOUNTS[0]);
  const [date, setDate] = useState(existing ? isoDate(new Date(existing.date)) : isoDate(TODAY));
  const [images, setImages] = useState<string[]>(existing?.images ?? []);

  const categories = data.categories.filter((item) => item.type === type);

  useEffect(() => {
    if (!categories.some((item) => item.id === categoryId)) {
      setCategoryId(categories[0]?.id ?? "");
    }
  }, [categories, categoryId]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Thiếu quyền", "Cần cấp quyền thư viện ảnh để đính kèm hóa đơn.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 3,
    });

    if (!result.canceled) {
      setImages((current) => [...current, ...result.assets.map((item) => item.uri)].slice(0, 4));
    }
  };

  return (
    <View style={styles.formWrap}>
      <View style={styles.segment}>
        <SegmentButton label="Chi tiêu" active={type === "expense"} onPress={() => setType("expense")} />
        <SegmentButton label="Thu nhập" active={type === "income"} onPress={() => setType("income")} />
      </View>

      <GlassCard>
        <Text style={styles.label}>Số tiền</Text>
        <TextInput
          value={amount}
          onChangeText={(text) => setAmount(text.replace(/[^\d]/g, ""))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={COLORS.muted}
          style={styles.amountInput}
        />
      </GlassCard>

      <GlassCard>
        <Text style={styles.label}>Danh mục</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.categoryChoices}>
            {categories.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.categoryChoice, categoryId === item.id && styles.categoryChoiceActive]}
                onPress={() => setCategoryId(item.id)}
              >
                <CategoryIcon category={item} compact active={categoryId === item.id} />
                <Text style={[styles.categoryChoiceText, categoryId === item.id && styles.categoryChoiceTextActive]}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </GlassCard>

      <GlassCard>
        <Text style={styles.label}>Ghi chú</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Ví dụ: ăn tối, nhận lương, mua sắm..."
          placeholderTextColor={COLORS.muted}
          style={styles.input}
        />

        <Text style={styles.label}>Ngày giao dịch</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={COLORS.muted}
          style={styles.input}
        />

        <Text style={styles.label}>Tài khoản</Text>
        <View style={styles.accountRow}>
          {ACCOUNTS.map((item) => (
            <Pressable
              key={item}
              style={[styles.accountChip, account === item && styles.accountChipActive]}
              onPress={() => setAccount(item)}
            >
              <Text style={[styles.accountChipText, account === item && styles.accountChipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Hóa đơn / ảnh đính kèm</Text>
        <View style={styles.imageActions}>
          <Pressable style={styles.secondaryAction} onPress={() => void pickImage()}>
            <Ionicons name="images-outline" size={16} color={COLORS.text} />
            <Text style={styles.secondaryActionText}>Chọn ảnh</Text>
          </Pressable>
          <Text style={styles.transactionMeta}>{images.length} ảnh đã chọn</Text>
        </View>
      </GlassCard>

      <Pressable
        style={styles.primaryAction}
        onPress={() => {
          const parsedAmount = Number(amount);
          if (!parsedAmount || !categoryId || !date) {
            Alert.alert("Thiếu dữ liệu", "Vui lòng nhập đủ số tiền, ngày và danh mục.");
            return;
          }

          saveTransaction({
            id: existing?.id,
            type,
            amount: parsedAmount,
            categoryId,
            note: note.trim(),
            account,
            date: new Date(date).toISOString(),
            images,
          });
          onSaved();
        }}
      >
        <Ionicons name="checkmark" size={18} color="#07162F" />
        <Text style={styles.primaryActionText}>{existing ? "Cập nhật giao dịch" : "Lưu giao dịch"}</Text>
      </Pressable>
    </View>
  );
}

function PinGate({
  visible,
  existingPin,
  onUnlock,
  onSetPin,
}: {
  visible: boolean;
  existingPin: string | null;
  onUnlock: () => void;
  onSetPin: (pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const creating = !existingPin;

  useEffect(() => {
    if (!visible) {
      setPin("");
      setFirstPin("");
    }
  }, [visible]);

  const submit = async () => {
    if (pin.length !== 4) {
      return;
    }

    if (existingPin) {
      if (pin === existingPin) {
        onUnlock();
      } else {
        Alert.alert("Sai mã PIN", "Vui lòng nhập lại.");
        setPin("");
      }
      return;
    }

    if (!firstPin) {
      setFirstPin(pin);
      setPin("");
      return;
    }

    if (firstPin !== pin) {
      Alert.alert("PIN không khớp", "Nhập lại 4 số để xác nhận.");
      setPin("");
      setFirstPin("");
      return;
    }

    await onSetPin(pin);
    setPin("");
    setFirstPin("");
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.pinOverlay}>
        <LinearGradient colors={["#101012", "#18181B"]} style={styles.pinCard}>
          <Avatar initials="NA" size={72} />
          <Text style={styles.pinTitle}>{creating ? "Thiết lập mã PIN" : "Nhập mã PIN"}</Text>
          <Text style={styles.pinSubtitle}>
            {creating
              ? firstPin
                ? "Nhập lại 4 số để xác nhận."
                : "App sẽ yêu cầu mã 4 số mỗi lần mở lại."
              : "Mở khóa để tiếp tục sử dụng ứng dụng."}
          </Text>

          <View style={styles.pinDots}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={[styles.pinDot, pin.length > index && styles.pinDotFilled]} />
            ))}
          </View>

          <View style={styles.keypad}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
              <Pressable
                key={key || "blank"}
                style={[styles.keypadKey, !key && styles.keypadKeyBlank]}
                disabled={!key}
                onPress={() => {
                  if (key === "⌫") {
                    setPin((current) => current.slice(0, -1));
                    return;
                  }

                  if (pin.length < 4) {
                    setPin((current) => `${current}${key}`);
                  }
                }}
              >
                <Text style={styles.keypadText}>{key}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.primaryAction} onPress={() => void submit()}>
            <Text style={styles.primaryActionText}>
              {creating ? (firstPin ? "Xác nhận PIN" : "Tiếp tục") : "Mở khóa"}
            </Text>
          </Pressable>
        </LinearGradient>
      </View>
    </Modal>
  );
}

function Screen({
  title,
  subtitle,
  profile,
  children,
  scrollable = true,
}: {
  title: string;
  subtitle: string;
  profile: { name: string; initials: string };
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const content = (
    <View style={styles.screenInner}>
      <View style={[styles.screenHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <Avatar initials={profile.initials || "NA"} />
      </View>
      {children}
      <View style={{ height: 16 }} />
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.ambientTop} />
      <View style={styles.ambientBottom} />
      {scrollable ? (
        <ScrollView contentContainerStyle={styles.screenScrollContent} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        <View style={styles.screenScrollContent}>{content}</View>
      )}
    </View>
  );
}

function Avatar({ initials, size = 40 }: { initials: string; size?: number }) {
  return (
    <LinearGradient colors={["#253556", "#121A29"]} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials}</Text>
    </LinearGradient>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.glassCard}>{children}</View>;
}

function MetricCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <GlassCard>
      <View style={[styles.metricIcon, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.transactionMeta}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </GlassCard>
  );
}

function TabIcon({
  label,
  icon,
  color,
  focused,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
}

function CategoryIcon({
  category,
  compact = false,
  active = false,
  large = false,
}: {
  category?: Category;
  compact?: boolean;
  active?: boolean;
  large?: boolean;
}) {
  const size = large ? 58 : compact ? 34 : 44;

  return (
    <View
      style={[
        styles.categoryIcon,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${category?.color ?? COLORS.primary}22`,
          borderColor: active ? category?.color ?? COLORS.primary : "rgba(255,255,255,0.08)",
        },
      ]}
    >
      <Ionicons name={(category?.icon ?? "ellipse") as any} size={large ? 28 : compact ? 16 : 20} color={category?.color ?? COLORS.primary} />
    </View>
  );
}

function SettingsRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.settingsRow} onPress={onPress}>
      <View style={styles.settingsLeft}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
        <Text style={styles.transactionTitle}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
    </Pressable>
  );
}

function SettingsToggle({
  label,
  icon,
  value,
  onValueChange,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsLeft}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
        <Text style={styles.transactionTitle}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? COLORS.primaryStrong : "#AAA"}
        trackColor={{ false: "#444", true: "#2A426D" }}
      />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.transactionMeta}>{label}</Text>
      <Text style={styles.transactionTitle}>{value}</Text>
    </View>
  );
}

function IconButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.iconButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color={COLORS.text} />
    </Pressable>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function createTransaction(
  type: TransactionType,
  amount: number,
  categoryId: string,
  note: string,
  date: string,
  account: string,
  images: string[]
): Transaction {
  return {
    id: `tx_${Math.random().toString(36).slice(2, 9)}`,
    type,
    amount,
    categoryId,
    note,
    date: new Date(date).toISOString(),
    account,
    images,
  };
}

function normalizeData(input: Partial<AppData>): AppData {
  return {
    profile: input.profile ?? INITIAL_DATA.profile,
    categories: input.categories?.length ? input.categories : INITIAL_DATA.categories,
    transactions: sortTransactions(input.transactions?.length ? input.transactions : INITIAL_DATA.transactions),
    currency: input.currency ?? "VND",
    requirePinOnResume: input.requirePinOnResume ?? true,
    isPremium: input.isPremium ?? false,
  };
}

function sortTransactions(items: Transaction[]) {
  return [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function getTotals(transactions: Transaction[]) {
  const income = sumByType(transactions, "income");
  const expense = sumByType(transactions, "expense");
  return {
    income,
    expense,
    balance: income - expense,
  };
}

function sumByType(transactions: Transaction[], type: TransactionType) {
  return transactions
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + item.amount, 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function offsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function sameMonth(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function buildDailyTrend(transactions: Transaction[]) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = isoDate(date);
    const value = transactions
      .filter((item) => item.type === "expense" && isoDate(new Date(item.date)) === key)
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      key,
      label: new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(date).slice(0, 2),
      value,
    };
  });
}

function trendMax(trend: { key: string; label: string; value: number }[]) {
  return Math.max(...trend.map((item) => item.value), 0);
}

function buildCalendar(monthDate: Date, transactions: Transaction[]) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstDay = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - firstDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = isoDate(date);
    const dailyItems = transactions.filter((item) => isoDate(new Date(item.date)) === key);

    return {
      date,
      inMonth: date.getMonth() === monthDate.getMonth(),
      income: dailyItems.filter((item) => item.type === "income").length,
      expense: dailyItems.filter((item) => item.type === "expense").length,
    };
  });
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthBuckets(transactions: Transaction[]) {
  return Array.from({ length: 6 }, (_, index) => {
    const cursor = new Date(TODAY.getFullYear(), TODAY.getMonth() - (5 - index), 1);
    const total = transactions
      .filter((item) => sameMonth(new Date(item.date), cursor) && item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      label: `T${cursor.getMonth() + 1}`,
      total,
    };
  });
}

function summarizeCategories(transactions: Transaction[], categories: Category[]) {
  return categories
    .map((category) => {
      const items = transactions.filter(
        (item) => item.categoryId === category.id && sameMonth(new Date(item.date), TODAY)
      );
      return {
        categoryId: category.id,
        name: category.name,
        type: category.type,
        total: items.reduce((sum, item) => sum + item.amount, 0),
        count: items.length,
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

function toCsv(transactions: Transaction[], categories: Category[]) {
  const categoryMap = Object.fromEntries(categories.map((item) => [item.id, item]));
  const rows = [
    ["id", "type", "amount", "category", "note", "date", "account", "images"].join(","),
    ...transactions.map((item) =>
      [
        csvCell(item.id),
        csvCell(item.type),
        csvCell(String(item.amount)),
        csvCell(categoryMap[item.categoryId]?.name ?? ""),
        csvCell(item.note),
        csvCell(item.date),
        csvCell(item.account),
        csvCell(item.images.join("|")),
      ].join(",")
    ),
  ];

  return rows.join("\n");
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function fromCsv(content: string, currentCategories: Category[]) {
  const rows = parseCsv(content);
  const headers = rows[0] ?? [];
  const categoryMap = new Map(currentCategories.map((item) => [item.name.toLowerCase(), item]));
  const importedCategories = [...currentCategories];

  const importedTransactions = rows.slice(1).flatMap((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
    const rawType = record.type === "income" ? "income" : "expense";
    const categoryName = (record.category || "Khác").trim();
    let category = categoryMap.get(categoryName.toLowerCase());

    if (!category) {
      category = {
        id: `cat_${Date.now()}_${Math.round(Math.random() * 10000)}`,
        name: categoryName,
        type: rawType,
        icon: rawType === "income" ? "cash" : "ellipsis-horizontal-circle",
        color: rawType === "income" ? COLORS.income : COLORS.expense,
      };
      categoryMap.set(category.name.toLowerCase(), category);
      importedCategories.push(category);
    }

    const amount = Number(record.amount);
    if (!amount || Number.isNaN(amount)) {
      return [];
    }

    return [
      {
        id: record.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: rawType,
        amount,
        categoryId: category.id,
        note: record.note || "",
        date: record.date || new Date().toISOString(),
        account: record.account || ACCOUNTS[0],
        images: record.images ? record.images.split("|").filter(Boolean) : [],
      } satisfies Transaction,
    ];
  });

  return {
    importedTransactions,
    importedCategories,
  };
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((item) => item.some((value) => value.trim().length > 0));
}

function dateStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  splashTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "700",
  },
  splashText: {
    color: COLORS.muted,
    marginTop: 10,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  ambientTop: {
    position: "absolute",
    top: -80,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(75,142,255,0.08)",
  },
  ambientBottom: {
    position: "absolute",
    right: -60,
    bottom: 120,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(250,155,0,0.06)",
  },
  screenScrollContent: {
    paddingBottom: 120,
  },
  screenInner: {
    paddingHorizontal: 20,
    gap: 16,
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  headerSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "700",
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarText: {
    color: COLORS.text,
    fontWeight: "700",
  },
  balanceBlock: {
    marginTop: 4,
    marginBottom: 4,
  },
  sectionLabel: {
    color: COLORS.muted,
    fontSize: 15,
    marginBottom: 8,
  },
  balanceValue: {
    color: COLORS.primary,
    fontSize: 36,
    fontWeight: "700",
  },
  balanceMeta: {
    color: COLORS.muted,
    marginTop: 4,
  },
  glassCard: {
    backgroundColor: "rgba(31,31,33,0.72)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "600",
  },
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 4,
  },
  chartColumn: {
    flex: 1,
    alignItems: "center",
  },
  chartTrack: {
    height: 108,
    width: 22,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartBar: {
    width: "100%",
    borderRadius: 14,
  },
  chartLabel: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  transactionTextBlock: {
    flex: 1,
  },
  transactionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
  transactionMeta: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 2,
  },
  transactionAmount: {
    color: COLORS.text,
    fontWeight: "700",
  },
  amountIncome: {
    color: COLORS.income,
  },
  amountExpense: {
    color: COLORS.expense,
  },
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 34,
    backgroundColor: "rgba(31,31,33,0.94)",
    borderTopWidth: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingTop: 8,
  },
  tabIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minWidth: 64,
    paddingVertical: 4,
    borderRadius: 16,
  },
  tabIconWrapActive: {
    backgroundColor: "rgba(173,198,255,0.10)",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  entryTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 84,
  },
  entryTabLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.text,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  dayCell: {
    width: "12.2%",
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  dayCellActive: {
    backgroundColor: "rgba(173,198,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(173,198,255,0.26)",
  },
  dayCellOutside: {
    opacity: 0.35,
  },
  dayLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  dayLabelMuted: {
    color: "#6B7280",
  },
  dayLabelActive: {
    color: COLORS.primary,
  },
  dayDots: {
    flexDirection: "row",
    gap: 2,
    marginTop: 3,
    minHeight: 4,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  emptyText: {
    color: COLORS.muted,
    lineHeight: 20,
  },
  formWrap: {
    gap: 14,
    flex: 1,
  },
  segment: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.surface3,
  },
  segmentText: {
    color: COLORS.muted,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: COLORS.text,
  },
  label: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  amountInput: {
    color: COLORS.primary,
    fontSize: 34,
    fontWeight: "700",
    paddingVertical: 8,
  },
  input: {
    backgroundColor: COLORS.surface3,
    borderRadius: 16,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryChoices: {
    flexDirection: "row",
    gap: 10,
  },
  categoryChoice: {
    alignItems: "center",
    gap: 8,
    minWidth: 88,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  categoryChoiceActive: {
    borderColor: "rgba(173,198,255,0.28)",
    backgroundColor: "rgba(173,198,255,0.12)",
  },
  categoryChoiceText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  categoryChoiceTextActive: {
    color: COLORS.text,
  },
  accountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  accountChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.surface3,
  },
  accountChipActive: {
    backgroundColor: "rgba(173,198,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(173,198,255,0.26)",
  },
  accountChipText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  accountChipTextActive: {
    color: COLORS.primary,
  },
  imageActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryAction: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: "#07162F",
    fontWeight: "700",
  },
  secondaryAction: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryActionText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  monthBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 150,
  },
  monthBarItem: {
    flex: 1,
    alignItems: "center",
  },
  monthBarTrack: {
    width: 28,
    height: 128,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  monthBar: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: COLORS.expense,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reportLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  settingsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  detailHero: {
    alignItems: "center",
    gap: 10,
  },
  detailCategory: {
    color: COLORS.muted,
    fontSize: 15,
  },
  detailAmount: {
    fontSize: 30,
    fontWeight: "700",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  optionScroller: {
    marginTop: -4,
  },
  iconChoice: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: COLORS.surface3,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  iconChoiceActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  colorChoice: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorChoiceActive: {
    borderColor: COLORS.text,
  },
  pinOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  pinCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  pinTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "700",
  },
  pinSubtitle: {
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  pinDots: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 4,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "transparent",
  },
  pinDotFilled: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  keypad: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  keypadKey: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  keypadKeyBlank: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  keypadText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "600",
  },
  pinInput: {
    backgroundColor: COLORS.surface3,
    borderRadius: 18,
    color: COLORS.text,
    fontSize: 28,
    textAlign: "center",
    paddingVertical: 16,
    letterSpacing: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface3,
  },
  categoryIcon: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
