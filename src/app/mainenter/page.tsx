"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  order: number;
  parentId?: string | null;
  metaTitle?: string;
  metaDescription?: string;
  seoText?: string;
  _count?: { products: number; children?: number };
}


interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  oldPrice: number | null;
  image: string;
  image2: string;
  image3: string;
  image4: string;
  inStock: number;
  expirationDate: string;
  brand: string;
  color: string;
  productType: string;
  isFeatured: boolean;
  categoryId: string;
  category?: Category;
  packSize: number | null;
  tags: string;
  metaTitle: string;
  metaDescription: string;
}

interface ImportRow {
  index: number;
  section: string;
  name: string;
  color: string;
  price: number;
  image: string;
}


interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  type: string;
  published: boolean;
  createdAt: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: { name: string };
}

interface Order {
  id: string;
  status: string;
  total: number;
  name: string;
  phone: string;
  address: string;
  comment: string;
  adminNote: string;
  createdAt: string;
  user: { email: string; name: string };
  items: OrderItem[];
}

const statusLabels: Record<string, string> = {
  new: "Новый",
  processing: "В обработке",
  shipped: "Отправлен",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

type TabType = "analytics" | "categories" | "products" | "reviews" | "news" | "orders" | "inquiries" | "callbacks" | "clients" | "constructor" | "admins" | "settings";

interface HomeBlock {
  id: string;
  blockType: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  image: string;
  bgImage: string;
  order: number;
  active: boolean;
  config: string;
}

interface AdminUser {
  id: string;
  username: string;
  role: string;
}

interface CallbackItem {
  id: string;
  name: string;
  phone: string;
  status: string;
  createdAt: string;
}

interface AnalyticsData {
  period: string;
  data: { date: string; label: string; views: number; unique: number }[];
  totalViews: number;
  totalUniqueVisitors: number;
  topPages: { path: string; views: number }[];
}

interface SiteSettings {
  disableUserEmailVerification: boolean;
  disableCheckoutEmailVerification: boolean;
}

interface MsgItem { id: string; senderId: string; senderRole: string; text: string; createdAt: string; }

function OrdersPanel({ orders, statusLabels, updateOrderStatus, updateOrderNote, deleteOrder, token }: {
  orders: Order[]; statusLabels: Record<string, string>;
  updateOrderStatus: (id: string, status: string) => void;
  updateOrderNote: (id: string, adminNote: string) => Promise<boolean>;
  deleteOrder: (id: string) => void; token: string;
}) {
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgItem[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState<Record<string, string>>({});

  const saveNote = async (order: Order) => {
    const value = noteDrafts[order.id] ?? order.adminNote ?? "";
    setSavingNote(order.id);
    setNoteMessage((current) => ({ ...current, [order.id]: "" }));
    const saved = await updateOrderNote(order.id, value);
    setSavingNote(null);
    setNoteMessage((current) => ({
      ...current,
      [order.id]: saved ? "Сохранено" : "Не удалось сохранить",
    }));
    if (saved) setNoteDrafts((current) => {
      const next = { ...current };
      delete next[order.id];
      return next;
    });
  };

  const loadMessages = async (orderId: string) => {
    const res = await fetch(`/api/admin/messages?orderId=${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setMessages(await res.json());
  };

  const toggleChat = (orderId: string) => {
    if (openChat === orderId) { setOpenChat(null); return; }
    setOpenChat(orderId);
    setMsgText("");
    loadMessages(orderId);
  };

  const sendMessage = async () => {
    if (!msgText.trim() || !openChat) return;
    setSending(true);
    await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId: openChat, text: msgText.trim() }),
    });
    setMsgText("");
    setSending(false);
    loadMessages(openChat);
  };

  return (
    <div className="bg-bg-white rounded-xl border border-border p-5">
      <h2 className="font-bold text-text-dark mb-4">Заказы ({orders.length})</h2>
      {orders.length === 0 ? <p className="text-text-gray text-sm">Заказов пока нет</p> : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="p-4 bg-bg-light rounded-lg">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <span className="font-medium text-text-dark">#{order.id.slice(0, 8)}</span>
                  <span className="text-sm text-text-gray ml-2">{new Date(order.createdAt).toLocaleString("ru-RU")}</span>
                  <span className="text-sm text-text-gray ml-2">— {order.user.name} ({order.user.email})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleChat(order.id)} className={`text-sm px-3 py-1 rounded-lg border ${openChat === order.id ? "bg-primary text-white border-primary" : "border-border text-text-gray hover:text-primary"}`}>
                    💬 Сообщения
                  </button>
                  <select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                    className="border border-border rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-primary">
                    {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {(order.status === "cancelled" || order.status === "delivered") && (
                    <button onClick={() => deleteOrder(order.id)} className="text-sm px-3 py-1 rounded-lg border border-danger text-danger hover:bg-danger hover:text-white transition-colors">
                      🗑 Удалить
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm space-y-1">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-text-gray">
                    <span>{item.product.name} x {item.quantity}</span>
                    <span>{(item.price * item.quantity).toLocaleString("ru-RU")} ₽</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-border/50 flex justify-between text-sm">
                <span className="text-text-gray">Адрес: {order.address} | Тел: {order.phone}</span>
                <span className="font-bold text-primary">{order.total.toLocaleString("ru-RU")} ₽</span>
              </div>
              {order.comment && <p className="text-xs text-text-gray mt-1">Комментарий: {order.comment}</p>}
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor={`admin-note-${order.id}`} className="text-xs font-semibold text-amber-900">
                    📝 Заметка администратора
                  </label>
                  <span className="text-xs text-amber-700">
                    {noteMessage[order.id] || "Покупателю не видна"}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    id={`admin-note-${order.id}`}
                    value={noteDrafts[order.id] ?? order.adminNote ?? ""}
                    onChange={(event) => {
                      setNoteDrafts((current) => ({ ...current, [order.id]: event.target.value }));
                      setNoteMessage((current) => ({ ...current, [order.id]: "" }));
                    }}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") saveNote(order);
                    }}
                    maxLength={5000}
                    rows={2}
                    placeholder="Например: клиент просил позвонить после 18:00"
                    className="min-h-16 flex-1 resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-text-dark focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => saveNote(order)}
                    disabled={savingNote === order.id || (noteDrafts[order.id] ?? order.adminNote ?? "") === (order.adminNote ?? "")}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingNote === order.id ? "..." : "Сохранить"}
                  </button>
                </div>
              </div>

              {openChat === order.id && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                    {messages.length === 0 && <p className="text-xs text-text-gray italic">Нет сообщений</p>}
                    {messages.map((msg) => (
                      <div key={msg.id} className={`text-sm p-2 rounded-lg max-w-[80%] ${msg.senderRole === "admin" ? "bg-primary/10 text-primary ml-auto" : "bg-bg-white border border-border"}`}>
                        <p className="text-xs text-text-gray mb-0.5">{msg.senderRole === "admin" ? "Вы" : "Клиент"} — {new Date(msg.createdAt).toLocaleString("ru-RU")}</p>
                        <p>{msg.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Написать клиенту..."
                      onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                    <button onClick={sendMessage} disabled={sending || !msgText.trim()}
                      className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50">
                      {sending ? "..." : "Отправить"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("categories");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("");
  const [catOrder, setCatOrder] = useState(0);
  const [catParentId, setCatParentId] = useState("");
  const [catMetaTitle, setCatMetaTitle] = useState("");
  const [uploadingCatIcon, setUploadingCatIcon] = useState(false);
  const [catMetaDesc, setCatMetaDesc] = useState("");
  const [catSeoText, setCatSeoText] = useState("");
  const [editingCat, setEditingCat] = useState<Category | null>(null);


  const [prodForm, setProdForm] = useState({
    name: "", description: "", price: "", oldPrice: "", image: "", image2: "", image3: "", image4: "",
    inStock: "0", packSize: "", expirationDate: "", brand: "", color: "", productType: "", categoryId: "", isFeatured: false, tags: "", metaTitle: "", metaDescription: "",
  });
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState("");
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [prodPage, setProdPage] = useState(1);
  const PROD_PER_PAGE = 10;
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [adminSettings, setAdminSettings] = useState({ newUsername: "", currentPassword: "", newPassword: "" });
  const [adminSettingsMsg, setAdminSettingsMsg] = useState("");
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({ disableUserEmailVerification: false, disableCheckoutEmailVerification: false });
  const [siteSettingsMsg, setSiteSettingsMsg] = useState("");



  const [newsForm, setNewsForm] = useState({ title: "", excerpt: "", content: "", image: "", type: "article", published: false });
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);

  const [importStatus, setImportStatus] = useState("");
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importColumnMap, setImportColumnMap] = useState<Record<string, string>>({});
  const [importSample, setImportSample] = useState<Record<string, string>[]>([]);
  const [importRawRows, setImportRawRows] = useState<Record<string, string>[]>([]);
  const [importStep, setImportStep] = useState<"idle" | "mapping" | "preview">("idle");

  const [bulkImgLoading, setBulkImgLoading] = useState(false);
  const [bulkImgStatus, setBulkImgStatus] = useState("");
  const [bulkImgResults, setBulkImgResults] = useState<{ fileName: string; matched: boolean; productName?: string }[] | null>(null);

  const hdrs = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    const [catRes, prodRes, newsRes, ordersRes, siteSettingsRes] = await Promise.all([
      fetch("/api/admin/categories", { headers: hdrs() }),
      fetch("/api/admin/products", { headers: hdrs() }),
      fetch("/api/admin/news", { headers: hdrs() }),
      fetch("/api/admin/orders", { headers: hdrs() }),
      fetch("/api/admin/settings", { headers: hdrs() }),
    ]);
    if (catRes.ok) setCategories(await catRes.json());
    if (prodRes.ok) setProducts(await prodRes.json());
    if (newsRes.ok) setNews(await newsRes.json());
    if (ordersRes.ok) setOrders(await ordersRes.json());
    if (siteSettingsRes.ok) {
      const data = await siteSettingsRes.json();
      setSiteSettings({
        disableUserEmailVerification: Boolean(data.disableUserEmailVerification),
        disableCheckoutEmailVerification: Boolean(data.disableCheckoutEmailVerification),
      });
    }
  }, [token, hdrs]);

  useEffect(() => {
    const saved = localStorage.getItem("admin_token");
    if (saved) startTransition(() => setToken(saved));
  }, []);

  useEffect(() => {
    startTransition(() => { fetchData(); });
  }, [fetchData]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      setToken(data.token);
      localStorage.setItem("admin_token", data.token);
    } else {
      setLoginError(data.error);
    }
  };

  const logout = () => { setToken(""); localStorage.removeItem("admin_token"); };

  // Category CRUD
  const uploadCatIcon = async (file: File) => {
    setUploadingCatIcon(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (res.ok) { const { url } = await res.json(); setCatIcon(url); }
    setUploadingCatIcon(false);
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingCat ? "PUT" : "POST";
    const seoFields = { metaTitle: catMetaTitle, metaDescription: catMetaDesc, seoText: catSeoText };
    const body = editingCat
      ? { id: editingCat.id, name: catName, icon: catIcon, order: catOrder, parentId: catParentId || null, ...seoFields }
      : { name: catName, icon: catIcon, order: catOrder, parentId: catParentId || null, ...seoFields };
    const res = await fetch("/api/admin/categories", { method, headers: hdrs(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Не удалось сохранить категорию"); return; }
    setCatName(""); setCatIcon(""); setCatOrder(0); setCatParentId(""); setCatMetaTitle(""); setCatMetaDesc(""); setCatSeoText(""); setEditingCat(null);
    fetchData();
  };

  // Site pages
  const deleteCategory = async (id: string) => {
    if (!confirm("Удалить пустую категорию? Категории с товарами или дочерними элементами защищены от удаления.")) return;
    const res = await fetch("/api/admin/categories", { method: "DELETE", headers: hdrs(), body: JSON.stringify({ id }) });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Категория не удалена"); return; }
    fetchData();
  };

  // Product CRUD
  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingProd ? "PUT" : "POST";
    const body = editingProd ? { id: editingProd.id, ...prodForm } : prodForm;
    await fetch("/api/admin/products", { method, headers: hdrs(), body: JSON.stringify(body) });
    setProdForm({ name: "", description: "", price: "", oldPrice: "", image: "", image2: "", image3: "", image4: "", inStock: "0", packSize: "", expirationDate: "", brand: "", color: "", productType: "", categoryId: "", isFeatured: false, tags: "", metaTitle: "", metaDescription: "" });
    setEditingProd(null); fetchData();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Удалить товар?")) return;
    await fetch("/api/admin/products", { method: "DELETE", headers: hdrs(), body: JSON.stringify({ id }) });
    setSelectedProducts((prev) => { const next = new Set(prev); next.delete(id); return next; });
    fetchData();
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllProducts = () => {
    const visible = paginatedProducts;
    const allSelected = visible.every((p) => selectedProducts.has(p.id));
    if (allSelected && visible.length > 0) {
      const next = new Set(selectedProducts);
      visible.forEach((p) => next.delete(p.id));
      setSelectedProducts(next);
    } else {
      const next = new Set(selectedProducts);
      visible.forEach((p) => next.add(p.id));
      setSelectedProducts(next);
    }
  };

  const bulkDeleteProducts = async () => {
    if (selectedProducts.size === 0) return;
    if (!confirm(`Удалить ${selectedProducts.size} товар(ов)?`)) return;
    await fetch("/api/admin/products", {
      method: "DELETE",
      headers: hdrs(),
      body: JSON.stringify({ ids: Array.from(selectedProducts) }),
    });
    setSelectedProducts(new Set());
    fetchData();
  };

  const bulkAssignCategory = async () => {
    if (selectedProducts.size === 0 || !bulkCategoryId) return;
    await fetch("/api/admin/products", {
      method: "PUT",
      headers: hdrs(),
      body: JSON.stringify({ ids: Array.from(selectedProducts), categoryId: bulkCategoryId }),
    });
    setSelectedProducts(new Set());
    setBulkCategoryId("");
    fetchData();
  };

  const exportProducts = async () => {
    if (selectedProducts.size === 0) return;
    const res = await fetch("/api/admin/export", {
      method: "POST",
      headers: hdrs(),
      body: JSON.stringify({ ids: Array.from(selectedProducts) }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportNoTags = async () => {
    const res = await fetch("/api/admin/export", {
      method: "POST",
      headers: hdrs(),
      body: JSON.stringify({ filter: "no-tags" }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Ошибка экспорта");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_no_tags_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkSetStock = async (stock: number) => {
    if (!confirm(`Установить остаток ${stock.toLocaleString()} на ВСЕ товары (${products.length} шт)?`)) return;
    const res = await fetch("/api/admin/products", {
      method: "PUT",
      headers: hdrs(),
      body: JSON.stringify({ bulkStock: stock }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Обновлено ${data.updated} товаров`);
      fetchData();
    }
  };

  const uploadImage = async (file: File, field: string) => {
    setUploadingImage(field);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      setProdForm((prev) => ({ ...prev, [field]: data.url }));
    }
    setUploadingImage(null);
  };

  const updateAdminSettings = async () => {
    setAdminSettingsMsg("");
    const res = await fetch("/api/admin/auth", {
      method: "PUT",
      headers: hdrs(),
      body: JSON.stringify(adminSettings),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.token) {
        setToken(data.token);
        localStorage.setItem("admin_token", data.token);
      }
      setAdminSettings({ newUsername: "", currentPassword: "", newPassword: "" });
      setAdminSettingsMsg("Данные обновлены");
      setTimeout(() => setAdminSettingsMsg(""), 3000);
    } else {
      setAdminSettingsMsg(data.error || "Ошибка");
    }
  };

  const updateSiteSettings = async () => {
    setSiteSettingsMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: hdrs(),
      body: JSON.stringify(siteSettings),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.settings) {
        setSiteSettings({
          disableUserEmailVerification: Boolean(data.settings.disableUserEmailVerification),
          disableCheckoutEmailVerification: Boolean(data.settings.disableCheckoutEmailVerification),
        });
      }
      setSiteSettingsMsg("Настройки сохранены");
      setTimeout(() => setSiteSettingsMsg(""), 3000);
    } else {
      setSiteSettingsMsg(data.error || "Ошибка");
    }
  };

  const filteredProducts = products.filter((p) => {
    if (filterCategory && p.categoryId !== filterCategory) return false;
    if (hideOutOfStock && p.inStock <= 0) return false;
    if (productSearch && !p.name.toLowerCase().includes(productSearch.toLowerCase()) && !p.brand.toLowerCase().includes(productSearch.toLowerCase())) return false;
    return true;
  });
  const prodTotalPages = Math.ceil(filteredProducts.length / PROD_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((prodPage - 1) * PROD_PER_PAGE, prodPage * PROD_PER_PAGE);



  // Target fields for column mapping (simplified for new format)
  const targetFields: { value: string; label: string }[] = [
    { value: "", label: "— Пропустить —" },
    { value: "section", label: "Раздел (категория)" },
    { value: "name", label: "Название товара" },
    { value: "color", label: "Цвет" },
    { value: "price", label: "Цена (₽)" },
    { value: "oldPrice", label: "Старая цена" },
    { value: "image", label: "Файл изображения" },
    { value: "description", label: "Описание" },
    { value: "brand", label: "Бренд" },
    { value: "country", label: "Страна" },
    { value: "barcode", label: "Штрихкод" },
    { value: "code", label: "Код/Артикул" },
    { value: "productType", label: "Тип/Вид" },
    { value: "inStock", label: "В наличии" },
    { value: "packSize", label: "Кол-во в упаковке" },
    { value: "weight", label: "Вес (кг)" },
    { value: "volume", label: "Объём (м³)" },
    { value: "tags", label: "Теги / ключевые слова" },
    { value: "metaTitle", label: "SEO Заголовок" },
    { value: "metaDescription", label: "SEO Описание" },
  ];

  // Import — step 1: upload file to server for fast parsing
  const handleImportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportStatus("Обработка файла...");
    setImportPreview([]);
    setImportStep("idle");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/import", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        setImportStatus("Ошибка: файл слишком большой или сервер не ответил. Попробуйте файл поменьше.");
        setImportLoading(false);
        e.target.value = "";
        return;
      }
      if (!res.ok || !data.headers) {
        setImportStatus(`Ошибка: ${data.error || "Не удалось обработать файл"}`);
        setImportLoading(false);
        e.target.value = "";
        return;
      }

      setImportHeaders(data.headers);
      setImportColumnMap(data.autoMap || {});
      setImportSample(data.sample || []);
      setImportRawRows(data.rows || []);
      setImportStep("mapping");
      setImportStatus(`Найдено ${data.totalRows} товаров`);
    } catch (err) {
      setImportStatus(`Ошибка: ${err instanceof Error ? err.message : "неизвестная ошибка"}`);
    }
    setImportLoading(false);
    e.target.value = "";
  };

  // Import — step 2: apply mapping client-side (no server call)
  const handleImportPreview = () => {
    const preview: ImportRow[] = importRawRows.map((row, i) => {
      const mapped: Record<string, string> = {};
      for (const [sourceCol, targetField] of Object.entries(importColumnMap)) {
        if (targetField && row[sourceCol] !== undefined) {
          mapped[targetField] = row[sourceCol];
        }
      }
      return {
        index: i,
        section: mapped.section || "",
        name: mapped.name || "",
        color: mapped.color || "",
        price: mapped.price ? Number(mapped.price) : 0,
        image: mapped.image || "",
      };
    });
    setImportPreview(preview);
    const all = new Set<number>(preview.map((r) => r.index));
    setImportSelected(all);
    setImportStep("preview");
  };

  // Import — step 3: send mapped data as JSON (no file re-upload)
  const handleImportSelected = async () => {
    if (importSelected.size === 0) return;
    setImportLoading(true);
    setImportStatus("Импорт...");

    // Apply mapping to selected raw rows and send as JSON
    const products = importRawRows
      .filter((_, i) => importSelected.has(i))
      .map((row) => {
        const mapped: Record<string, string> = {};
        for (const [sourceCol, targetField] of Object.entries(importColumnMap)) {
          if (targetField && row[sourceCol] !== undefined) {
            mapped[targetField] = row[sourceCol];
          }
        }
        return mapped;
      });

    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { ...hdrs() },
      body: JSON.stringify({ products }),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      setImportStatus("Ошибка: слишком много товаров для одной загрузки. Разбейте файл на части.");
      setImportLoading(false);
      return;
    }
    setImportLoading(false);
    if (res.ok) {
      setImportStatus(`Новых: ${data.imported}, обновлено: ${data.updated || 0} из ${data.total}${data.categoriesCreated ? `, категорий создано: ${data.categoriesCreated}` : ""}`);
      resetImport();
      fetchData();
    } else {
      setImportStatus(`Ошибка: ${data.error}`);
    }
    setTimeout(() => setImportStatus(""), 5000);
  };

  const resetImport = () => {
    setImportPreview([]);
    setImportSelected(new Set());
    setImportHeaders([]);
    setImportColumnMap({});
    setImportSample([]);
    setImportRawRows([]);
    setImportStep("idle");
    setImportStatus("");
  };

  const toggleImportRow = (index: number) => {
    setImportSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleImportAll = () => {
    if (importSelected.size === importPreview.length) {
      setImportSelected(new Set());
    } else {
      setImportSelected(new Set(importPreview.map((r) => r.index)));
    }
  };

  const searchProduct = (name: string) => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(name + " товар описание фото")}&tbm=isch`, "_blank");
  };

  // Bulk image upload — sends files in batches to handle large volumes (500MB+)
  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setBulkImgLoading(true);
    setBulkImgResults(null);

    const BATCH_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB per batch
    const MAX_FILES_PER_BATCH = 50;
    const allFiles = Array.from(fileList);
    const allResults: { fileName: string; matched: boolean; productName?: string }[] = [];
    let totalMatched = 0;
    let totalUnmatched = 0;

    // Split files into batches
    const batches: File[][] = [];
    let currentBatch: File[] = [];
    let currentSize = 0;
    for (const file of allFiles) {
      if (currentBatch.length >= MAX_FILES_PER_BATCH || (currentSize + file.size > BATCH_SIZE_LIMIT && currentBatch.length > 0)) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }
      currentBatch.push(file);
      currentSize += file.size;
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    for (let i = 0; i < batches.length; i++) {
      setBulkImgStatus(`Загрузка пакета ${i + 1} из ${batches.length} (${allFiles.length} файлов)...`);
      const formData = new FormData();
      for (const file of batches[i]) {
        formData.append("files", file);
      }
      try {
        const res = await fetch("/api/admin/bulk-images", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch {
          allResults.push(...batches[i].map(f => ({ fileName: f.name, matched: false })));
          totalUnmatched += batches[i].length;
          continue;
        }
        if (!res.ok) {
          allResults.push(...batches[i].map(f => ({ fileName: f.name, matched: false })));
          totalUnmatched += batches[i].length;
        } else {
          totalMatched += data.matched || 0;
          totalUnmatched += data.unmatched || 0;
          if (data.results) allResults.push(...data.results);
        }
      } catch {
        allResults.push(...batches[i].map(f => ({ fileName: f.name, matched: false })));
        totalUnmatched += batches[i].length;
      }
    }

    setBulkImgStatus(`Привязано: ${totalMatched} из ${allFiles.length}${totalUnmatched > 0 ? `, не найдено: ${totalUnmatched}` : ""}`);
    setBulkImgResults(allResults);
    fetchData();
    setBulkImgLoading(false);
    e.target.value = "";
  };

  // News CRUD
  const saveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingNews ? "PUT" : "POST";
    const body = editingNews ? { id: editingNews.id, ...newsForm } : newsForm;
    await fetch("/api/admin/news", { method, headers: hdrs(), body: JSON.stringify(body) });
    setNewsForm({ title: "", excerpt: "", content: "", image: "", type: "article", published: false });
    setEditingNews(null); fetchData();
  };

  const deleteNews = async (id: string) => {
    if (!confirm("Удалить новость?")) return;
    await fetch("/api/admin/news", { method: "DELETE", headers: hdrs(), body: JSON.stringify({ id }) });
    fetchData();
  };

  // Order status update
  const updateOrderStatus = async (id: string, status: string) => {
    await fetch("/api/admin/orders", { method: "PUT", headers: hdrs(), body: JSON.stringify({ id, status }) });
    fetchData();
  };

  const updateOrderNote = async (id: string, adminNote: string) => {
    const res = await fetch("/api/admin/orders", {
      method: "PUT",
      headers: hdrs(),
      body: JSON.stringify({ id, adminNote }),
    });
    if (!res.ok) return false;
    const updated = await res.json();
    setOrders((current) => current.map((order) => (
      order.id === id ? { ...order, adminNote: updated.adminNote || "" } : order
    )));
    return true;
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Удалить заказ? Это действие необратимо.")) return;
    await fetch("/api/admin/orders", { method: "DELETE", headers: hdrs(), body: JSON.stringify({ id }) });
    fetchData();
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-bg-light flex items-center justify-center px-4">
        <div className="bg-bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-xl mx-auto mb-3 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center shadow-lg">
              <span className="text-white font-extrabold text-2xl tracking-tight">HT</span>
            </div>
            <h1 className="text-xl font-bold text-text-dark">Админ-панель hittabak</h1>
            <p className="text-sm text-text-gray mt-1">Введите данные для входа</p>
          </div>
          <form onSubmit={login} className="space-y-4">
            <input type="text" placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-primary" />
            <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-primary" />
            {loginError && <p className="text-danger text-sm">{loginError}</p>}
            <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 rounded-lg transition-colors">Войти</button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/" className="text-sm text-primary hover:underline">← На главную</Link>
          </div>
        </div>
      </div>
    );
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const categoryDepth = (category: Category) => {
    let depth = 0;
    let parentId = category.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      depth++;
      parentId = categoryById.get(parentId)?.parentId;
    }
    return depth;
  };
  const categoryLevelName = (depth: number) => ["Тип", "Бренд", "Модель", "Цвет"][depth] || `Уровень ${depth + 1}`;
  const sortedCategories = (() => {
    const byParent = new Map<string | null, Category[]>();
    for (const category of categories) {
      const list = byParent.get(category.parentId || null) || [];
      list.push(category); byParent.set(category.parentId || null, list);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ru"));
    const result: Category[] = [];
    const visit = (parentId: string | null) => { for (const item of byParent.get(parentId) || []) { result.push(item); visit(item.id); } };
    visit(null); return result;
  })();
  const categoryLabel = (category: Category) => `${"— ".repeat(categoryDepth(category))}${category.name}`;
  const categoryPathLabel = (category: Category) => {
    const names = [category.name]; let parentId = category.parentId; const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) { seen.add(parentId); const parent = categoryById.get(parentId); if (!parent) break; names.unshift(parent.name); parentId = parent.parentId; }
    return names.join(" / ");
  };
  const invalidParentIds = new Set<string>(editingCat ? [editingCat.id] : []);
  if (editingCat) {
    let changed = true;
    while (changed) { changed = false; for (const category of categories) if (category.parentId && invalidParentIds.has(category.parentId) && !invalidParentIds.has(category.id)) { invalidParentIds.add(category.id); changed = true; } }
  }
  const categoryParentOptions = sortedCategories.filter((category) => categoryDepth(category) < 3 && !invalidParentIds.has(category.id));
  const tabLabels: Record<TabType, string> = {
    analytics: "Статистика", categories: "Категории", products: "Товары", reviews: "Отзывы", news: "Новости", orders: `Заказы (${orders.length})`, inquiries: "Заявки", callbacks: `Заявки на звонок`, clients: "Клиенты", constructor: "Конструктор", admins: "Администраторы", settings: "Настройки",
  };

  return (
    <div className="min-h-screen bg-bg-light">
      <header className="bg-bg-white shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
              <span className="text-white font-extrabold text-xs tracking-tight">HT</span>
            </div>
            <h1 className="text-lg font-bold text-text-dark">hittabak — Админ</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-primary hover:underline">На сайт</Link>
            <button onClick={logout} className="text-sm text-danger hover:underline">Выйти</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {(Object.keys(tabLabels) as TabType[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === tab ? "bg-primary text-white" : "bg-bg-white text-text-gray hover:text-text-dark border border-border"}`}>
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Analytics */}
        {activeTab === "analytics" && <AnalyticsPanel token={token} />}

        {/* Categories */}
        {activeTab === "categories" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <h2 className="font-bold text-text-dark mb-4">{editingCat ? "Редактировать" : "Добавить"} категорию</h2>
              <form onSubmit={saveCategory} className="space-y-3">
                <input type="text" placeholder="Название" value={catName} onChange={(e) => setCatName(e.target.value)} required
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <div>
                  <label className="text-xs text-text-gray mb-1 block">Изображение категории (256x256)</label>
                  <div className="flex gap-2 items-center">
                    <input type="text" placeholder="URL или эмодзи (напр. 📦)" value={catIcon} onChange={(e) => setCatIcon(e.target.value)}
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                    <label className="px-3 py-2 bg-bg-light border border-border rounded-lg text-sm cursor-pointer hover:bg-primary/5">
                      {uploadingCatIcon ? "..." : "Файл"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadCatIcon(e.target.files[0]); }} />
                    </label>
                  </div>
                  {catIcon && catIcon.startsWith("/") && (
                    <img src={catIcon} alt="Превью" className="mt-2 w-16 h-16 object-cover rounded-lg border border-border" />
                  )}
                </div>
                <select value={catParentId} onChange={(e) => setCatParentId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
                  <option value="">Корневая категория</option>
                  {categoryParentOptions.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c)} ({categoryLevelName(categoryDepth(c))})</option>)}
                </select>
                <input type="number" placeholder="Порядок" value={catOrder} onChange={(e) => setCatOrder(Number(e.target.value))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <div className="border-t border-border pt-3 mt-3">
                  <p className="text-xs text-text-gray mb-2 font-medium">SEO настройки</p>
                  <input type="text" placeholder="Meta Title (для поисковиков)" value={catMetaTitle} onChange={(e) => setCatMetaTitle(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary mb-2" />
                  <input type="text" placeholder="Meta Description" value={catMetaDesc} onChange={(e) => setCatMetaDesc(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary mb-2" />
                  <textarea placeholder="SEO-текст (описание категории)" value={catSeoText} onChange={(e) => setCatSeoText(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" rows={3} />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-primary hover:bg-primary-dark text-white text-sm py-2 rounded-lg">{editingCat ? "Сохранить" : "Добавить"}</button>
                  {editingCat && <button type="button" onClick={() => { setEditingCat(null); setCatName(""); setCatIcon(""); setCatOrder(0); setCatParentId(""); setCatMetaTitle(""); setCatMetaDesc(""); setCatSeoText(""); }} className="px-4 bg-bg-light text-text-gray text-sm py-2 rounded-lg">Отмена</button>}
                </div>
              </form>
            </div>
            <div className="lg:col-span-2 bg-bg-white rounded-xl border border-border p-5">
              <h2 className="font-bold text-text-dark mb-4">Все категории ({categories.length})</h2>
              {categories.length === 0 ? <p className="text-text-gray text-sm">Категорий пока нет</p> : (
                <div className="space-y-2">
                  {sortedCategories.map((cat) => { const depth = categoryDepth(cat); return (
                    <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-light/70 border-l-2 border-primary/20" style={{ marginLeft: `${depth * 24}px` }}>
                      <div className="flex items-center gap-2">
                        {cat.icon && (cat.icon.startsWith("/") || cat.icon.startsWith("http")) ? (
                          <img src={cat.icon} alt="" className="w-8 h-8 object-cover rounded" />
                        ) : (
                          <span className="text-lg">{cat.icon || "📦"}</span>
                        )}
                        <div>
                          <span className="font-medium text-text-dark">{cat.name}</span>
                          <span className="text-xs text-primary ml-2">{categoryLevelName(depth)}</span>
                          <span className="text-text-light text-sm ml-2">({cat._count?.products || 0} товаров)</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingCat(cat); setCatName(cat.name); setCatIcon(cat.icon || ""); setCatOrder(cat.order); setCatParentId(cat.parentId || ""); setCatMetaTitle(cat.metaTitle || ""); setCatMetaDesc(cat.metaDescription || ""); setCatSeoText(cat.seoText || ""); }} className="text-primary hover:underline text-sm">Изменить</button>
                        <button onClick={() => deleteCategory(cat.id)} className="text-danger hover:underline text-sm">Удалить</button>
                      </div>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Products */}
        {activeTab === "products" && (
          <div className="space-y-6">
            {/* Import section */}
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <h2 className="font-bold text-text-dark mb-3">Импорт товаров</h2>
              <p className="text-sm text-text-gray mb-3">
                Загрузите XLSX файл с колонками: №, Раздел, Название товара, Цвет, Цена (₽), Файл изображения.
                Раздел — существующая категория. Для новой структуры сначала создайте тип → бренд → модель → цвет в разделе «Категории».
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm px-4 py-2 rounded-lg cursor-pointer transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  {importStep !== "idle" ? "Загрузить другой файл" : "Выбрать файл"}
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImportUpload} className="hidden" />
                </label>
                {importStep !== "idle" && (
                  <button onClick={resetImport} className="text-sm text-danger hover:underline">Отмена</button>
                )}
                {importLoading && <span className="text-sm text-text-gray">Загрузка...</span>}
                {importStatus && <span className={`text-sm ${importStatus.startsWith("Ошибка") ? "text-danger" : "text-success"}`}>{importStatus}</span>}
              </div>

              {/* Step 1: Column mapping */}
              {importStep === "mapping" && importHeaders.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-bold text-text-dark mb-2">Шаг 1: Настройте соответствие колонок</h3>
                  <p className="text-xs text-text-gray mb-3">Для каждой колонки файла выберите поле товара. Автоматически определённые поля уже выбраны.</p>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Колонка файла</th>
                          <th className="px-3 py-2 text-left">Поле товара</th>
                          <th className="px-3 py-2 text-left">Пример данных</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importHeaders.map((header) => (
                          <tr key={header} className="border-t border-border">
                            <td className="px-3 py-2 font-medium">{header}</td>
                            <td className="px-3 py-2">
                              <select
                                value={importColumnMap[header] || ""}
                                onChange={(e) => setImportColumnMap({ ...importColumnMap, [header]: e.target.value })}
                                className="border border-border rounded px-2 py-1 text-sm w-full max-w-[200px] focus:outline-none focus:border-primary"
                              >
                                {targetFields.map((f) => (
                                  <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-text-gray text-xs max-w-[200px] truncate">
                              {importSample.map((s, i) => (
                                <span key={i}>{i > 0 && " | "}{s[header] || "—"}</span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleImportPreview}
                      disabled={importLoading || !Object.values(importColumnMap).some((v) => v === "name")}
                      className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                      Предпросмотр
                    </button>
                    {!Object.values(importColumnMap).some((v) => v === "name") && (
                      <span className="text-xs text-danger self-center">Выберите колонку для &quot;Название&quot;</span>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Preview & select rows */}
              {importStep === "preview" && importPreview.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-bold text-text-dark mb-2">Шаг 2: Выберите товары для импорта</h3>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-text-dark">
                      Найдено: {importPreview.length} | Выбрано: {importSelected.size}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setImportStep("mapping")} className="text-sm text-primary hover:underline">
                        Назад к маппингу
                      </button>
                      <button onClick={toggleImportAll} className="text-sm text-primary hover:underline">
                        {importSelected.size === importPreview.length ? "Снять все" : "Выбрать все"}
                      </button>
                      <button
                        onClick={handleImportSelected}
                        disabled={importSelected.size === 0 || importLoading}
                        className="bg-success hover:bg-green-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                      >
                        Импортировать ({importSelected.size})
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-left">
                            <input type="checkbox" checked={importSelected.size === importPreview.length} onChange={toggleImportAll} />
                          </th>
                          <th className="px-2 py-2 text-left">Раздел</th>
                          <th className="px-2 py-2 text-left">Название товара</th>
                          <th className="px-2 py-2 text-left">Цвет</th>
                          <th className="px-2 py-2 text-right">Цена (₽)</th>
                          <th className="px-2 py-2 text-left">Файл изображения</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row) => (
                          <tr
                            key={row.index}
                            className={`border-t border-border hover:bg-gray-50 cursor-pointer ${importSelected.has(row.index) ? "bg-blue-50" : ""}`}
                            onClick={() => toggleImportRow(row.index)}
                          >
                            <td className="px-2 py-1.5">
                              <input type="checkbox" checked={importSelected.has(row.index)} onChange={() => toggleImportRow(row.index)} />
                            </td>
                            <td className="px-2 py-1.5">{row.section || "—"}</td>
                            <td className="px-2 py-1.5 max-w-[200px] truncate" title={row.name}>{row.name || "—"}</td>
                            <td className="px-2 py-1.5">{row.color || "—"}</td>
                            <td className="px-2 py-1.5 text-right">{row.price || "—"}</td>
                            <td className="px-2 py-1.5 max-w-[150px] truncate" title={row.image}>{row.image || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Bulk image upload section */}
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <h2 className="font-bold text-text-dark mb-3">Загрузить пак изображений</h2>
              <p className="text-sm text-text-gray mb-3">
                Выберите изображения (PNG, JPG, WEBP, до 600 МБ общий объём). Имя файла = название товара. Система автоматически сопоставит файлы с товарами.
                Загрузка идёт пакетами — можно загружать сотни файлов за раз. Знаки препинания, дефисы, подчёркивания игнорируются при поиске.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg cursor-pointer transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Загрузить пак
                  <input type="file" accept=".jpg,.jpeg,.png,.gif,.webp,.svg" multiple onChange={handleBulkImageUpload} className="hidden" />
                </label>
                {bulkImgLoading && <span className="text-sm text-text-gray">Загрузка...</span>}
                {bulkImgStatus && <span className={`text-sm ${bulkImgStatus.startsWith("Ошибка") ? "text-danger" : "text-success"}`}>{bulkImgStatus}</span>}
                {bulkImgResults && (
                  <button onClick={() => { setBulkImgResults(null); setBulkImgStatus(""); }} className="text-sm text-danger hover:underline">Скрыть отчёт</button>
                )}
              </div>

              {bulkImgResults && bulkImgResults.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-bold text-text-dark mb-2">Результат сопоставления</h3>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Файл</th>
                          <th className="px-3 py-2 text-left">Статус</th>
                          <th className="px-3 py-2 text-left">Товар</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkImgResults.map((r, i) => (
                          <tr key={i} className={`border-t border-border ${r.matched ? "bg-green-50" : "bg-red-50"}`}>
                            <td className="px-3 py-1.5 max-w-[200px] truncate" title={r.fileName}>{r.fileName}</td>
                            <td className="px-3 py-1.5">
                              {r.matched ? (
                                <span className="text-success font-medium">Привязано</span>
                              ) : (
                                <span className="text-danger font-medium">Не найдено</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">{r.productName || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-bg-white rounded-xl border border-border p-5">
              <h2 className="font-bold text-text-dark mb-4">{editingProd ? "Редактировать" : "Добавить"} товар</h2>
              <form onSubmit={saveProduct} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <input type="text" placeholder="Название *" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} required
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <input type="number" placeholder="Цена *" value={prodForm.price} onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })} required
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <input type="number" placeholder="Старая цена" value={prodForm.oldPrice} onChange={(e) => setProdForm({ ...prodForm, oldPrice: e.target.value })}
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <div className="border border-border rounded-lg px-3 py-2 text-sm">
                  <label className="text-text-gray text-xs block mb-1">Изображение 1 (основное)</label>
                  <div className="flex gap-2 items-center">
                    <input type="text" placeholder="URL или загрузите файл" value={prodForm.image} onChange={(e) => setProdForm({ ...prodForm, image: e.target.value })}
                      className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary" />
                    <label className="cursor-pointer bg-bg-light hover:bg-gray-200 text-text-gray text-xs px-2 py-1 rounded transition-colors">
                      {uploadingImage === "image" ? "..." : "Файл"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "image"); e.target.value = ""; }} />
                    </label>
                  </div>
                  {prodForm.image && <img src={prodForm.image} alt="" className="mt-1 w-12 h-12 object-cover rounded" />}
                </div>
                <div className="border border-border rounded-lg px-3 py-2 text-sm">
                  <label className="text-text-gray text-xs block mb-1">Изображение 2</label>
                  <div className="flex gap-2 items-center">
                    <input type="text" placeholder="URL или загрузите файл" value={prodForm.image2} onChange={(e) => setProdForm({ ...prodForm, image2: e.target.value })}
                      className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary" />
                    <label className="cursor-pointer bg-bg-light hover:bg-gray-200 text-text-gray text-xs px-2 py-1 rounded transition-colors">
                      {uploadingImage === "image2" ? "..." : "Файл"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "image2"); e.target.value = ""; }} />
                    </label>
                  </div>
                  {prodForm.image2 && <img src={prodForm.image2} alt="" className="mt-1 w-12 h-12 object-cover rounded" />}
                </div>
                <div className="border border-border rounded-lg px-3 py-2 text-sm">
                  <label className="text-text-gray text-xs block mb-1">Изображение 3</label>
                  <div className="flex gap-2 items-center">
                    <input type="text" placeholder="URL или загрузите файл" value={prodForm.image3} onChange={(e) => setProdForm({ ...prodForm, image3: e.target.value })}
                      className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary" />
                    <label className="cursor-pointer bg-bg-light hover:bg-gray-200 text-text-gray text-xs px-2 py-1 rounded transition-colors">
                      {uploadingImage === "image3" ? "..." : "Файл"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "image3"); e.target.value = ""; }} />
                    </label>
                  </div>
                  {prodForm.image3 && <img src={prodForm.image3} alt="" className="mt-1 w-12 h-12 object-cover rounded" />}
                </div>
                <div className="border border-border rounded-lg px-3 py-2 text-sm">
                  <label className="text-text-gray text-xs block mb-1">Изображение 4</label>
                  <div className="flex gap-2 items-center">
                    <input type="text" placeholder="URL или загрузите файл" value={prodForm.image4} onChange={(e) => setProdForm({ ...prodForm, image4: e.target.value })}
                      className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary" />
                    <label className="cursor-pointer bg-bg-light hover:bg-gray-200 text-text-gray text-xs px-2 py-1 rounded transition-colors">
                      {uploadingImage === "image4" ? "..." : "Файл"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "image4"); e.target.value = ""; }} />
                    </label>
                  </div>
                  {prodForm.image4 && <img src={prodForm.image4} alt="" className="mt-1 w-12 h-12 object-cover rounded" />}
                </div>
                <input type="number" placeholder="В наличии" value={prodForm.inStock} onChange={(e) => setProdForm({ ...prodForm, inStock: e.target.value })}
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <input type="number" placeholder="Кол-во в упаковке" value={prodForm.packSize} onChange={(e) => setProdForm({ ...prodForm, packSize: e.target.value })}
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <input type="text" placeholder="Бренд" value={prodForm.brand} onChange={(e) => setProdForm({ ...prodForm, brand: e.target.value })}
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <input type="text" placeholder="Цвет" value={prodForm.color} onChange={(e) => setProdForm({ ...prodForm, color: e.target.value })}
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <input type="text" placeholder="Тип товара" value={prodForm.productType} onChange={(e) => setProdForm({ ...prodForm, productType: e.target.value })}
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <select value={prodForm.categoryId} onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })} required
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
                  <option value="">Выберите категорию *</option>
                  {sortedCategories.map((cat) => <option key={cat.id} value={cat.id}>{categoryLabel(cat)}</option>)}
                </select>
                <div className="md:col-span-2 lg:col-span-3 relative">
                  <textarea placeholder="Описание" value={prodForm.description} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary pr-10" rows={2} />
                  {prodForm.name && (
                    <button type="button" title="Сгенерировать описание через ИИ-поиск" onClick={() => {
                      const query = `Напиши короткое SEO-описание товара "${prodForm.name}" для интернет-магазина, 2-3 предложения`;
                      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
                    }} className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-md transition-all hover:scale-110 cursor-pointer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
                    </button>
                  )}
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <input type="text" placeholder="Теги / ключевые слова (через запятую)" value={prodForm.tags} onChange={(e) => setProdForm({ ...prodForm, tags: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                  <p className="text-xs text-text-gray mt-1">Мета-теги для поисковиков. Не видны клиентам на сайте.</p>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <input type="text" placeholder="SEO заголовок (meta title)" value={prodForm.metaTitle} onChange={(e) => setProdForm({ ...prodForm, metaTitle: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                  <p className="text-xs text-text-gray mt-1">Заголовок страницы для поисковиков. Если пусто — используется название товара.</p>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <textarea placeholder="SEO описание (meta description)" value={prodForm.metaDescription} onChange={(e) => setProdForm({ ...prodForm, metaDescription: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary h-16 resize-none" />
                  <p className="text-xs text-text-gray mt-1">Описание для поисковиков (до 160 символов). Если пусто — используется описание товара.</p>
                </div>
                <div className="md:col-span-2 lg:col-span-3 flex items-center gap-4">
                  <button type="submit" className="bg-primary hover:bg-primary-dark text-white text-sm px-6 py-2 rounded-lg">{editingProd ? "Сохранить" : "Добавить"}</button>
                  {editingProd && <button type="button" onClick={() => { setEditingProd(null); setProdForm({ name: "", description: "", price: "", oldPrice: "", image: "", image2: "", image3: "", image4: "", inStock: "0", packSize: "", expirationDate: "", brand: "", color: "", productType: "", categoryId: "", isFeatured: false, tags: "", metaTitle: "", metaDescription: "" }); }} className="px-4 bg-bg-light text-text-gray text-sm py-2 rounded-lg">Отмена</button>}
                  <label className="flex items-center gap-2 text-sm cursor-pointer ml-auto border border-yellow-300 bg-yellow-50 rounded-lg px-3 py-2">
                    <input type="checkbox" checked={prodForm.isFeatured} onChange={(e) => setProdForm({ ...prodForm, isFeatured: e.target.checked })} className="accent-yellow-500 w-4 h-4" />
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <span className="text-yellow-700 font-medium">Популярный товар</span>
                  </label>
                </div>
              </form>
            </div>
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-bold text-text-dark">Все товары ({filteredProducts.length}{filterCategory || hideOutOfStock || productSearch ? ` из ${products.length}` : ""})</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedProducts.size > 0 && (
                    <>
                      <select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)}
                        className="border border-border rounded-lg px-2 py-1.5 text-sm">
                        <option value="">Назначить категорию...</option>
                        {sortedCategories.map((cat) => <option key={cat.id} value={cat.id}>{categoryLabel(cat)}</option>)}
                      </select>
                      {bulkCategoryId && (
                        <button onClick={bulkAssignCategory} className="bg-primary hover:bg-primary-dark text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
                          Применить ({selectedProducts.size})
                        </button>
                      )}
                      <button onClick={exportProducts} className="bg-accent hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Выгрузить ({selectedProducts.size})
                      </button>
                      <button onClick={bulkDeleteProducts} className="bg-danger hover:bg-red-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
                        Удалить ({selectedProducts.size})
                      </button>
                    </>
                  )}
                  <button onClick={() => bulkSetStock(10000)} className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1" title="Установить остаток 10 000 на все товары">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    Остаток 10 000
                  </button>
                  {(() => {
                    const noTagsCount = products.filter((p) => !p.tags).length;
                    return noTagsCount > 0 ? (
                      <button onClick={exportNoTags} className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1" title="Скачать товары без мета-тегов">
                        <span className="inline-flex items-center justify-center w-4 h-4 bg-white text-orange-600 rounded-full text-xs font-bold">!</span>
                        Без тегов ({noTagsCount})
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <div className="relative">
                  <svg className="w-4 h-4 text-text-gray absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setProdPage(1); setSelectedProducts(new Set()); }}
                    placeholder="Поиск по названию или бренду..."
                    className="border border-border rounded-lg pl-9 pr-8 py-1.5 text-sm w-64 focus:outline-none focus:border-primary" />
                  {productSearch && <button onClick={() => { setProductSearch(""); setProdPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-gray hover:text-text-dark text-lg">&times;</button>}
                </div>
                <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setProdPage(1); setSelectedProducts(new Set()); }}
                  className="border border-border rounded-lg px-3 py-1.5 text-sm">
                  <option value="">Все категории</option>
                  {sortedCategories.map((cat) => <option key={cat.id} value={cat.id}>{categoryLabel(cat)}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-sm text-text-gray cursor-pointer">
                  <input type="checkbox" checked={hideOutOfStock} onChange={(e) => { setHideOutOfStock(e.target.checked); setProdPage(1); setSelectedProducts(new Set()); }} className="w-4 h-4 rounded" />
                  Скрыть отсутствующие (0 шт)
                </label>
              </div>
              {filteredProducts.length === 0 ? <p className="text-text-gray text-sm">Товаров не найдено</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      <th className="py-2 px-2 w-8">
                        <input type="checkbox" checked={selectedProducts.size === paginatedProducts.length && paginatedProducts.length > 0} onChange={toggleAllProducts} className="w-4 h-4 rounded border-border cursor-pointer" />
                      </th>
                      <th className="text-left py-2 px-2 text-text-gray font-medium w-12">Фото</th>
                      <th className="text-left py-2 px-2 text-text-gray font-medium">Название</th>
                      <th className="text-left py-2 px-2 text-text-gray font-medium">Категория</th>
                      <th className="text-right py-2 px-2 text-text-gray font-medium">Цена</th>
                      <th className="text-right py-2 px-2 text-text-gray font-medium">В наличии</th>
                      <th className="text-right py-2 px-2 text-text-gray font-medium">В упак.</th>
                      <th className="text-right py-2 px-2 text-text-gray font-medium">Действия</th>
                    </tr></thead>
                    <tbody>
                      {paginatedProducts.map((prod) => (
                        <tr key={prod.id} className={`border-b border-border/50 hover:bg-bg-light ${selectedProducts.has(prod.id) ? "bg-blue-50" : ""}`}>
                          <td className="py-2 px-2">
                            <input type="checkbox" checked={selectedProducts.has(prod.id)} onChange={() => toggleProductSelection(prod.id)} className="w-4 h-4 rounded border-border cursor-pointer" />
                          </td>
                          <td className="py-2 px-2">
                            {prod.image ? (
                              <img src={prod.image} alt="" className="w-10 h-10 rounded object-cover border border-border" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-bg-light border border-border flex items-center justify-center text-text-gray text-xs">—</div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-text-dark">
                            {prod.isFeatured && <svg className="w-4 h-4 text-yellow-500 inline mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                            {!prod.tags && <span title="Нет мета-тегов" className="inline-flex items-center justify-center w-4 h-4 bg-orange-100 text-orange-600 rounded-full text-xs font-bold mr-1 cursor-help">!</span>}
                            {prod.name}
                          </td>
                          <td className="py-2 px-2 text-text-gray">{prod.category ? categoryPathLabel(prod.category) : "—"}</td>
                          <td className="py-2 px-2 text-right font-medium">{prod.price.toLocaleString("ru-RU")} ₽</td>
                          <td className="py-2 px-2 text-right">{prod.inStock}</td>
                          <td className="py-2 px-2 text-right">{prod.packSize || "—"}</td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            <button onClick={() => searchProduct(prod.name)} className="text-accent hover:underline mr-2" title="Поиск в интернете">
                              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </button>
                            <button onClick={() => { setEditingProd(prod); setProdForm({ name: prod.name, description: prod.description, price: String(prod.price), oldPrice: prod.oldPrice ? String(prod.oldPrice) : "", image: prod.image, image2: prod.image2 || "", image3: prod.image3 || "", image4: prod.image4 || "", inStock: String(prod.inStock), packSize: prod.packSize ? String(prod.packSize) : "", expirationDate: prod.expirationDate || "", brand: prod.brand, color: prod.color, productType: prod.productType, categoryId: prod.categoryId, isFeatured: prod.isFeatured || false, tags: prod.tags || "", metaTitle: prod.metaTitle || "", metaDescription: prod.metaDescription || "" }); }} className="text-primary hover:underline mr-2">Изменить</button>
                            <button onClick={() => deleteProduct(prod.id)} className="text-danger hover:underline">Удалить</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {prodTotalPages > 1 && (() => {
                const pages: (number | "...")[] = [];
                for (let i = 1; i <= prodTotalPages; i++) {
                  if (i === 1 || i === prodTotalPages || (i >= prodPage - 1 && i <= prodPage + 1)) {
                    pages.push(i);
                  } else if (pages[pages.length - 1] !== "...") {
                    pages.push("...");
                  }
                }
                return (
                  <div className="flex items-center justify-center gap-1 mt-4 pt-3 border-t border-border">
                    <button onClick={() => setProdPage(p => Math.max(1, p - 1))} disabled={prodPage === 1}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-bg-light disabled:opacity-40 disabled:cursor-not-allowed">← Назад</button>
                    {pages.map((p, idx) => p === "..." ? (
                      <span key={`dots-${idx}`} className="px-2 py-1.5 text-text-gray text-sm">...</span>
                    ) : (
                      <button key={p} onClick={() => setProdPage(p as number)}
                        className={`w-8 h-8 text-sm rounded-lg ${p === prodPage ? "bg-primary text-white" : "border border-border hover:bg-bg-light text-text-gray"}`}>{p}</button>
                    ))}
                    <button onClick={() => setProdPage(p => Math.min(prodTotalPages, p + 1))} disabled={prodPage === prodTotalPages}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-bg-light disabled:opacity-40 disabled:cursor-not-allowed">Вперёд →</button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* News */}
        {activeTab === "news" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <h2 className="font-bold text-text-dark mb-4">{editingNews ? "Редактировать" : "Создать"} новость</h2>
              <form onSubmit={saveNews} className="space-y-3">
                <div>
                  <label className="text-xs text-text-gray mb-1 block">Заголовок *</label>
                  <input type="text" placeholder="Введите заголовок" value={newsForm.title} onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })} required
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-text-gray mb-1 block">Изображение</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="URL изображения" value={newsForm.image} onChange={(e) => setNewsForm({ ...newsForm, image: e.target.value })}
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                    <label className={`px-3 py-2 border border-border rounded-lg text-sm cursor-pointer transition-colors flex items-center gap-1 ${uploadingImage === "news" ? "bg-primary/10 text-primary border-primary" : "bg-bg-light text-text-gray hover:text-primary"}`}>
                      {uploadingImage === "news" ? (
                        <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> ...</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> Файл</>
                      )}
                      <input type="file" accept=".jpg,.jpeg,.png,.webp,.svg" className="hidden" disabled={uploadingImage === "news"} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 10 * 1024 * 1024) { alert("Макс. 10 МБ"); e.target.value = ""; return; }
                        setUploadingImage("news");
                        try {
                          const fd = new FormData(); fd.append("file", file);
                          const res = await fetch("/api/admin/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
                          if (res.ok) { const data = await res.json(); setNewsForm((prev) => ({ ...prev, image: data.url })); }
                          else { alert("Ошибка загрузки"); }
                        } catch { alert("Ошибка соединения"); }
                        finally { setUploadingImage(null); e.target.value = ""; }
                      }} />
                    </label>
                  </div>
                  {newsForm.image && (
                    <div className="mt-2 w-20 h-14 rounded overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={newsForm.image} alt="Превью" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <select value={newsForm.type} onChange={(e) => setNewsForm({ ...newsForm, type: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
                  <option value="article">Статья</option>
                  <option value="delivery">Поставка</option>
                </select>
                <div>
                  <label className="text-xs text-text-gray mb-1 block">Краткое описание</label>
                  <textarea placeholder="Короткий текст для карточки новости (1-2 предложения)" value={newsForm.excerpt} onChange={(e) => setNewsForm({ ...newsForm, excerpt: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" rows={2} />
                </div>
                <div>
                  <label className="text-xs text-text-gray mb-1 block">Полный текст</label>
                  <textarea placeholder="Полный текст новости..." value={newsForm.content} onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" rows={8} />
                </div>
                <label className="flex items-center gap-2 text-sm text-text-gray">
                  <input type="checkbox" checked={newsForm.published} onChange={(e) => setNewsForm({ ...newsForm, published: e.target.checked })} className="accent-primary" /> Опубликовать
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-primary hover:bg-primary-dark text-white text-sm py-2 rounded-lg">{editingNews ? "Сохранить" : "Создать"}</button>
                  {editingNews && <button type="button" onClick={() => { setEditingNews(null); setNewsForm({ title: "", excerpt: "", content: "", image: "", type: "article", published: false }); }} className="px-4 bg-bg-light text-text-gray text-sm py-2 rounded-lg">Отмена</button>}
                </div>
              </form>
            </div>
            <div className="lg:col-span-2 bg-bg-white rounded-xl border border-border p-5">
              <h2 className="font-bold text-text-dark mb-4">Все новости ({news.length})</h2>
              {news.length === 0 ? <p className="text-text-gray text-sm">Новостей пока нет</p> : (
                <div className="space-y-3">
                  {news.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-bg-light rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-dark truncate">{item.title}</p>
                        <div className="flex items-center gap-2 text-xs text-text-gray">
                          <span>{new Date(item.createdAt).toLocaleDateString("ru-RU")}</span>
                          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{item.type === "delivery" ? "Поставка" : "Статья"}</span>
                          <span className={item.published ? "text-success" : "text-danger"}>{item.published ? "Опубликовано" : "Черновик"}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 ml-4">
                        <button onClick={() => { setEditingNews(item); setNewsForm({ title: item.title, excerpt: item.excerpt || "", content: item.content, image: item.image, type: item.type || "article", published: item.published }); }} className="text-primary hover:underline text-sm">Изменить</button>
                        <button onClick={() => deleteNews(item.id)} className="text-danger hover:underline text-sm">Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Orders */}
        {activeTab === "orders" && (
          <OrdersPanel orders={orders} statusLabels={statusLabels} updateOrderStatus={updateOrderStatus} updateOrderNote={updateOrderNote} deleteOrder={deleteOrder} token={token} />
        )}
        {/* Inquiries */}
        {activeTab === "reviews" && <ReviewsPanel token={token} />}

        {activeTab === "inquiries" && <InquiriesPanel token={token} />}

        {/* Callbacks */}
        {activeTab === "callbacks" && <CallbacksPanel token={token} />}

        {/* Clients */}
        {activeTab === "clients" && <ClientsPanel token={token} />}

        {/* Constructor */}
        {activeTab === "constructor" && <ConstructorPanel token={token} />}

        {/* Admins */}
        {activeTab === "admins" && <AdminsPanel token={token} />}

        {/* Settings */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <h2 className="font-bold text-text-dark mb-4">Настройки аккаунта</h2>
              {adminSettingsMsg && (
                <p className={`text-sm mb-4 ${adminSettingsMsg.includes("Ошибка") || adminSettingsMsg.includes("Неверный") || adminSettingsMsg.includes("занят") ? "text-danger" : "text-success"}`}>{adminSettingsMsg}</p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-text-gray mb-1 block">Новый логин</label>
                  <input type="text" placeholder="Оставьте пустым, если не менять" value={adminSettings.newUsername}
                    onChange={(e) => setAdminSettings({ ...adminSettings, newUsername: e.target.value })}
                    className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-sm text-text-gray mb-1 block">Текущий пароль</label>
                  <input type="password" placeholder="Для смены пароля или логина" value={adminSettings.currentPassword}
                    onChange={(e) => setAdminSettings({ ...adminSettings, currentPassword: e.target.value })}
                    className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-sm text-text-gray mb-1 block">Новый пароль</label>
                  <input type="password" placeholder="Минимум 6 символов" value={adminSettings.newPassword}
                    onChange={(e) => setAdminSettings({ ...adminSettings, newPassword: e.target.value })}
                    className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary" />
                </div>
                <button onClick={updateAdminSettings} className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-lg transition-colors font-medium">
                  Сохранить
                </button>
              </div>
            </div>

            <div className="bg-bg-white rounded-xl border border-border p-5">
              <h2 className="font-bold text-text-dark mb-4">Настройки оформления и авторизации</h2>
              {siteSettingsMsg && (
                <p className={`text-sm mb-4 ${siteSettingsMsg.includes("Ошибка") ? "text-danger" : "text-success"}`}>{siteSettingsMsg}</p>
              )}
              <div className="space-y-4">
                <label className="flex items-start gap-3 p-3 bg-bg-light rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siteSettings.disableUserEmailVerification}
                    onChange={(e) => setSiteSettings((prev) => ({ ...prev, disableUserEmailVerification: e.target.checked }))}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <p className="font-medium text-text-dark">Отключить подтверждение email при регистрации</p>
                    <p className="text-sm text-text-gray">Новые пользователи смогут регистрироваться без кода из письма.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-bg-light rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siteSettings.disableCheckoutEmailVerification}
                    onChange={(e) => setSiteSettings((prev) => ({ ...prev, disableCheckoutEmailVerification: e.target.checked }))}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <p className="font-medium text-text-dark">Отключить подтверждение email при оформлении заказа</p>
                    <p className="text-sm text-text-gray">Клиенты смогут отправлять заявку без SMTP-подтверждения email.</p>
                  </div>
                </label>

                <button onClick={updateSiteSettings} className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-lg transition-colors font-medium">
                  Сохранить настройки
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsPanel({ token }: { token: string }) {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period, token]);

  const maxViews = data ? Math.max(...data.data.map((d) => d.views), 1) : 1;
  const maxUnique = data ? Math.max(...data.data.map((d) => d.unique), 1) : 1;
  const maxVal = Math.max(maxViews, maxUnique, 1);

  const periodLabels = { day: "Сегодня", week: "Неделя", month: "Месяц" };
  const avgLabel = period === "day" ? "в час" : "в день";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-text-dark">Статистика посещений</h2>
        <div className="flex gap-2">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p ? "bg-primary text-white" : "bg-bg-white border border-border text-text-gray hover:text-primary"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-gray">Загрузка...</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <p className="text-sm text-text-gray mb-1">Всего просмотров</p>
              <p className="text-3xl font-bold text-text-dark">{data.totalViews.toLocaleString("ru-RU")}</p>
              <p className="text-xs text-text-light mt-1">за {periodLabels[period].toLowerCase()}</p>
            </div>
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <p className="text-sm text-text-gray mb-1">Уникальные посетители</p>
              <p className="text-3xl font-bold text-accent">{data.totalUniqueVisitors.toLocaleString("ru-RU")}</p>
              <p className="text-xs text-text-light mt-1">за {periodLabels[period].toLowerCase()}</p>
            </div>
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <p className="text-sm text-text-gray mb-1">Среднее {avgLabel}</p>
              <p className="text-3xl font-bold text-text-dark">
                {data.data.length > 0 ? Math.round(data.totalViews / data.data.length).toLocaleString("ru-RU") : 0}
              </p>
              <p className="text-xs text-text-light mt-1">просмотров</p>
            </div>
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <p className="text-sm text-text-gray mb-1">Популярных страниц</p>
              <p className="text-3xl font-bold text-text-dark">{data.topPages.length}</p>
              <p className="text-xs text-text-light mt-1">уникальных URL</p>
            </div>
          </div>

          <div className="bg-bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-text-dark">График посещений</h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary/80 inline-block"></span> Просмотры</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-accent/80 inline-block"></span> Уникальные</span>
              </div>
            </div>
            <div className="flex items-end gap-1 h-52">
              {data.data.map((d, i) => {
                const viewsH = Math.max((d.views / maxVal) * 100, d.views > 0 ? 4 : 0);
                const uniqueH = Math.max((d.unique / maxVal) * 100, d.unique > 0 ? 4 : 0);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[10px] text-text-gray font-medium">{d.views || ""}</span>
                    <div className="w-full flex gap-px justify-center items-end" style={{ height: `${Math.max(viewsH, uniqueH, 2)}%` }}>
                      <div
                        className="flex-1 bg-primary/80 hover:bg-primary rounded-t transition-colors"
                        style={{ height: `${viewsH > 0 ? Math.max((d.views / Math.max(d.views, d.unique, 1)) * 100, 8) : 2}%`, minHeight: "2px" }}
                        title={`${d.label}: ${d.views} просмотров`}
                      />
                      <div
                        className="flex-1 bg-accent/80 hover:bg-accent rounded-t transition-colors"
                        style={{ height: `${uniqueH > 0 ? Math.max((d.unique / Math.max(d.views, d.unique, 1)) * 100, 8) : 2}%`, minHeight: "2px" }}
                        title={`${d.label}: ${d.unique} уникальных`}
                      />
                    </div>
                    <span className="text-[9px] text-text-light truncate w-full text-center">{d.label}</span>
                  </div>
                );
              })}
            </div>
            {data.data.length === 0 && (
              <p className="text-center text-text-gray text-sm py-8">Нет данных за выбранный период</p>
            )}
          </div>

          {data.topPages.length > 0 && (
            <div className="bg-bg-white rounded-xl border border-border p-5">
              <h3 className="font-bold text-text-dark mb-4">Популярные страницы</h3>
              <div className="space-y-2">
                {data.topPages.map((page, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-text-light w-6 text-right">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-text-dark truncate">{page.path}</span>
                        <span className="text-sm font-medium text-text-gray flex-shrink-0">{page.views} просм.</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-bg-light rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${(page.views / data.topPages[0].views) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-bg-white rounded-xl border border-border p-5">
            <h3 className="font-bold text-text-dark mb-2">Яндекс.Метрика и Google Analytics</h3>
            <p className="text-sm text-text-gray mb-3">
              Для детальной аналитики используйте внешние сервисы:
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="https://metrika.yandex.ru/dashboard?id=109025489" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-bg-light border border-border rounded-lg text-sm text-text-dark hover:text-primary hover:border-primary transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                Яндекс.Метрика
              </a>
              <a href="https://analytics.google.com/analytics/web/#/report-home/a0p0" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-bg-light border border-border rounded-lg text-sm text-text-dark hover:text-primary hover:border-primary transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10 10-4.48 10-10z"/></svg>
                Google Analytics
              </a>
            </div>
          </div>
        </>
      ) : (
        <p className="text-text-gray">Не удалось загрузить данные</p>
      )}
    </div>
  );
}

interface InquiryItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  items: string;
  comment: string;
  address: string;
  total: number;
  status: string;
  createdAt: string;
}

function InquiriesPanel({ token }: { token: string }) {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadInquiries = async () => {
    const res = await fetch("/api/admin/inquiries", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setInquiries(await res.json());
    setLoading(false);
  };

  useEffect(() => { loadInquiries(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status }),
    });
    loadInquiries();
  };

  const deleteInquiry = async (id: string) => {
    if (!confirm("Удалить заявку?")) return;
    await fetch("/api/admin/inquiries", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    loadInquiries();
  };

  const statusLabels: Record<string, string> = { new: "Новая", processing: "В работе", done: "Завершена", cancelled: "Отменена" };
  const statusColors: Record<string, string> = { new: "bg-accent text-white", processing: "bg-primary text-white", done: "bg-success text-white", cancelled: "bg-gray-400 text-white" };

  const parseItems = (itemsStr: string): { productName: string; quantity: number; price: number; isPack: boolean }[] => {
    try { return JSON.parse(itemsStr); } catch { return []; }
  };

  if (loading) return <p className="text-text-gray">Загрузка...</p>;

  return (
    <div className="bg-bg-white rounded-xl border border-border p-5">
      <h2 className="font-bold text-text-dark mb-4">Заявки ({inquiries.length})</h2>
      {inquiries.length === 0 ? <p className="text-text-gray text-sm">Заявок пока нет</p> : (
        <div className="space-y-3">
          {inquiries.map((inq) => {
            const items = parseItems(inq.items);
            const isExpanded = expandedId === inq.id;
            return (
              <div key={inq.id} className="p-4 bg-bg-light rounded-lg">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[inq.status] || "bg-gray-200"}`}>
                        {statusLabels[inq.status] || inq.status}
                      </span>
                      <span className="text-xs text-text-gray">{new Date(inq.createdAt).toLocaleString("ru-RU")}</span>
                      <span className="text-xs font-medium text-text-dark">{inq.total.toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <p className="font-medium text-text-dark">{inq.name}</p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <a href={`tel:${inq.phone}`} className="text-primary hover:underline">{inq.phone}</a>
                      <a href={`mailto:${inq.email}`} className="text-primary hover:underline">{inq.email}</a>
                    </div>
                    {inq.address && <p className="text-xs text-text-gray mt-1">{inq.address}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                      className="text-sm px-3 py-1 rounded-lg border border-border text-text-gray hover:bg-bg-light transition-colors">
                      {isExpanded ? "Свернуть" : "Товары"}
                    </button>
                    <select value={inq.status} onChange={(e) => updateStatus(inq.id, e.target.value)}
                      className="border border-border rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-primary">
                      {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button onClick={() => deleteInquiry(inq.id)}
                      className="text-sm px-3 py-1 rounded-lg border border-danger text-danger hover:bg-danger hover:text-white transition-colors">
                      Удалить
                    </button>
                  </div>
                </div>
                {isExpanded && items.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3 space-y-1">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm text-text-gray">
                        <span>{item.productName} × {item.quantity}{item.isPack ? " (упаковка)" : ""}</span>
                        <span>{(item.price * item.quantity).toLocaleString("ru-RU")} ₽</span>
                      </div>
                    ))}
                    {inq.comment && <p className="text-sm text-text-gray mt-2 italic">Комментарий: {inq.comment}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CallbacksPanel({ token }: { token: string }) {
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCallbacks = async () => {
    const res = await fetch("/api/admin/callbacks", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setCallbacks(await res.json());
    setLoading(false);
  };

  useEffect(() => { loadCallbacks(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/callbacks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status }),
    });
    loadCallbacks();
  };

  const deleteCallback = async (id: string) => {
    if (!confirm("Удалить заявку?")) return;
    await fetch("/api/admin/callbacks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    loadCallbacks();
  };

  const statusLabels: Record<string, string> = { new: "Новая", processing: "В работе", done: "Выполнена" };
  const statusColors: Record<string, string> = { new: "bg-accent text-white", processing: "bg-primary text-white", done: "bg-success text-white" };

  if (loading) return <p className="text-text-gray">Загрузка...</p>;

  return (
    <div className="bg-bg-white rounded-xl border border-border p-5">
      <h2 className="font-bold text-text-dark mb-4">Заявки на звонок ({callbacks.length})</h2>
      {callbacks.length === 0 ? <p className="text-text-gray text-sm">Заявок пока нет</p> : (
        <div className="space-y-3">
          {callbacks.map((cb) => (
            <div key={cb.id} className="p-4 bg-bg-light rounded-lg flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[cb.status] || "bg-gray-200"}`}>
                    {statusLabels[cb.status] || cb.status}
                  </span>
                  <span className="text-xs text-text-gray">{new Date(cb.createdAt).toLocaleString("ru-RU")}</span>
                </div>
                <p className="font-medium text-text-dark">{cb.name}</p>
                <a href={`tel:${cb.phone}`} className="text-sm text-primary hover:underline">{cb.phone}</a>
              </div>
              <div className="flex items-center gap-2">
                <select value={cb.status} onChange={(e) => updateStatus(cb.id, e.target.value)}
                  className="border border-border rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-primary">
                  {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={() => deleteCallback(cb.id)}
                  className="text-sm px-3 py-1 rounded-lg border border-danger text-danger hover:bg-danger hover:text-white transition-colors">
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ClientItem {
  id: string;
  email: string;
  name: string;
  lastName: string;
  phone: string;
  city: string;
  createdAt: string;
  ordersCount: number;
  reviewsCount: number;
}

interface ClientDetails {
  id: string;
  email: string;
  name: string;
  lastName: string;
  phone: string;
  zipCode: string;
  region: string;
  city: string;
  street: string;
  building: string;
  apartment: string;
  createdAt: string;
  orders: { id: string; status: string; total: number; createdAt: string }[];
  reviews: { id: string; rating: number; text: string; createdAt: string; product: { name: string } }[];
}

function ClientsPanel({ token }: { token: string }) {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadClients = async () => {
    const res = await fetch("/api/admin/clients", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setClients(await res.json());
    setLoading(false);
  };

  useEffect(() => { loadClients(); }, []);

  const deleteClient = async (id: string, email: string) => {
    if (!confirm(`Удалить аккаунт клиента ${email}? Это действие необратимо — будут удалены все данные, заказы и отзывы.`)) return;
    await fetch("/api/admin/clients", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    setSelectedClient(null);
    loadClients();
  };

  const viewDetails = async (id: string) => {
    setDetailsLoading(true);
    const res = await fetch("/api/admin/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, action: "get-details" }),
    });
    if (res.ok) setSelectedClient(await res.json());
    setDetailsLoading(false);
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.lastName.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const totalOrders = clients.reduce((s, c) => s + c.ordersCount, 0);
  const totalReviews = clients.reduce((s, c) => s + c.reviewsCount, 0);

  if (loading) return <p className="text-text-gray">Загрузка...</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-bg-white rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-primary">{clients.length}</p>
          <p className="text-xs text-text-gray">Всего клиентов</p>
        </div>
        <div className="bg-bg-white rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-accent">{totalOrders}</p>
          <p className="text-xs text-text-gray">Всего заказов</p>
        </div>
        <div className="bg-bg-white rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-success">{totalReviews}</p>
          <p className="text-xs text-text-gray">Всего отзывов</p>
        </div>
        <div className="bg-bg-white rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-text-dark">{clients.filter((c) => {
            const d = new Date(c.createdAt);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }).length}</p>
          <p className="text-xs text-text-gray">Новых за месяц</p>
        </div>
      </div>

      <div className="bg-bg-white rounded-xl border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="font-bold text-text-dark">Клиенты ({filtered.length})</h2>
          <input type="text" placeholder="Поиск по email, имени, телефону..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-full sm:w-64" />
        </div>

        {filtered.length === 0 ? <p className="text-text-gray text-sm">Клиентов не найдено</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-gray">
                  <th className="pb-2 pr-3">Клиент</th>
                  <th className="pb-2 pr-3">Email</th>
                  <th className="pb-2 pr-3">Телефон</th>
                  <th className="pb-2 pr-3">Город</th>
                  <th className="pb-2 pr-3 text-center">Заказы</th>
                  <th className="pb-2 pr-3 text-center">Отзывы</th>
                  <th className="pb-2 pr-3">Регистрация</th>
                  <th className="pb-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-bg-light/50">
                    <td className="py-2.5 pr-3 font-medium text-text-dark">
                      {c.name || c.lastName ? `${c.lastName} ${c.name}`.trim() : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-primary">{c.email}</td>
                    <td className="py-2.5 pr-3">{c.phone || "—"}</td>
                    <td className="py-2.5 pr-3">{c.city || "—"}</td>
                    <td className="py-2.5 pr-3 text-center">{c.ordersCount}</td>
                    <td className="py-2.5 pr-3 text-center">{c.reviewsCount}</td>
                    <td className="py-2.5 pr-3 text-text-gray">{new Date(c.createdAt).toLocaleDateString("ru-RU")}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => viewDetails(c.id)}
                          className="text-xs px-2 py-1 rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors">
                          Подробнее
                        </button>
                        <button onClick={() => deleteClient(c.id, c.email)}
                          className="text-xs px-2 py-1 rounded border border-danger text-danger hover:bg-danger hover:text-white transition-colors">
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(selectedClient || detailsLoading) && (
        <div className="bg-bg-white rounded-xl border border-border p-5">
          {detailsLoading ? <p className="text-text-gray">Загрузка...</p> : selectedClient && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-text-dark">
                  {selectedClient.lastName} {selectedClient.name} — {selectedClient.email}
                </h2>
                <button onClick={() => setSelectedClient(null)} className="text-text-gray hover:text-text-dark text-lg">✕</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-dark mb-2">Контакты</h3>
                  <p className="text-sm text-text-gray">Email: <span className="text-text-dark">{selectedClient.email}</span></p>
                  <p className="text-sm text-text-gray">Телефон: <span className="text-text-dark">{selectedClient.phone || "не указан"}</span></p>
                  <p className="text-sm text-text-gray">Регистрация: <span className="text-text-dark">{new Date(selectedClient.createdAt).toLocaleString("ru-RU")}</span></p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-dark mb-2">Адрес доставки</h3>
                  {selectedClient.city || selectedClient.street ? (
                    <>
                      {selectedClient.zipCode && <p className="text-sm text-text-gray">Индекс: <span className="text-text-dark">{selectedClient.zipCode}</span></p>}
                      {selectedClient.region && <p className="text-sm text-text-gray">Регион: <span className="text-text-dark">{selectedClient.region}</span></p>}
                      {selectedClient.city && <p className="text-sm text-text-gray">Город: <span className="text-text-dark">{selectedClient.city}</span></p>}
                      {selectedClient.street && <p className="text-sm text-text-gray">Улица: <span className="text-text-dark">{selectedClient.street}</span></p>}
                      {selectedClient.building && <p className="text-sm text-text-gray">Дом: <span className="text-text-dark">{selectedClient.building}</span></p>}
                      {selectedClient.apartment && <p className="text-sm text-text-gray">Квартира: <span className="text-text-dark">{selectedClient.apartment}</span></p>}
                    </>
                  ) : <p className="text-sm text-text-gray">Не указан</p>}
                </div>
              </div>

              {selectedClient.orders.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-text-dark mb-2">Последние заказы ({selectedClient.orders.length})</h3>
                  <div className="space-y-1">
                    {selectedClient.orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between text-sm p-2 bg-bg-light rounded">
                        <span className="text-text-gray">{new Date(o.createdAt).toLocaleDateString("ru-RU")}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === "delivered" ? "bg-success text-white" : o.status === "cancelled" ? "bg-danger text-white" : "bg-primary text-white"}`}>
                          {statusLabels[o.status] || o.status}
                        </span>
                        <span className="font-medium text-text-dark">{o.total.toLocaleString("ru-RU")} ₽</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedClient.reviews.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-dark mb-2">Последние отзывы ({selectedClient.reviews.length})</h3>
                  <div className="space-y-1">
                    {selectedClient.reviews.map((r) => (
                      <div key={r.id} className="text-sm p-2 bg-bg-light rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-accent">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                          <span className="text-text-gray text-xs">{r.product.name}</span>
                        </div>
                        {r.text && <p className="text-text-dark text-xs">{r.text}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-border">
                <button onClick={() => deleteClient(selectedClient.id, selectedClient.email)}
                  className="text-sm px-4 py-2 rounded-lg border border-danger text-danger hover:bg-danger hover:text-white transition-colors">
                  Удалить аккаунт
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ConstructorPanel({ token }: { token: string }) {
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HomeBlock | null>(null);
  const [msg, setMsg] = useState("");

  const emptyBlock: Omit<HomeBlock, "id"> = {
    blockType: "hero", title: "", subtitle: "", buttonText: "", buttonLink: "",
    image: "", bgImage: "", order: 0, active: true, config: "{}",
  };
  const [form, setForm] = useState<Omit<HomeBlock, "id"> & { id?: string }>(emptyBlock);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/home-blocks", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setBlocks(await res.json());
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const method = form.id ? "PUT" : "POST";
    const body = form.id
      ? { id: form.id, ...form }
      : form;
    const res = await fetch("/api/admin/home-blocks", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setMsg(form.id ? "Блок обновлён" : "Блок создан");
      setForm(emptyBlock);
      setEditing(null);
      load();
    } else {
      const err = await res.json();
      setMsg(`Ошибка: ${err.error}`);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить блок?")) return;
    await fetch(`/api/admin/home-blocks?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  const startEdit = (block: HomeBlock) => {
    setEditing(block);
    setForm({ ...block });
  };

  const uploadImage = async (field: "image" | "bgImage") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/webm,video/mp4";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        const { url } = await res.json();
        setForm((prev) => ({ ...prev, [field]: url }));
      }
    };
    input.click();
  };

  const blockTypeLabels: Record<string, string> = {
    hero: "Главный баннер",
    device: "Продукт (устройство)",
    stick: "Стик",
    news: "Новость",
  };

  if (loading) return <div className="text-center py-12 text-text-gray">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-text-dark">Конструктор главной страницы</h2>
      {msg && <p className={`text-sm ${msg.includes("Ошибка") ? "text-danger" : "text-success"}`}>{msg}</p>}

      {/* Block form */}
      <div className="bg-bg-white rounded-xl border border-border p-5">
        <h3 className="font-bold text-text-dark mb-4">{editing ? "Редактировать блок" : "Добавить блок"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-text-gray mb-1 block">Тип блока</label>
            <select value={form.blockType} onChange={(e) => setForm({ ...form, blockType: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary">
              {Object.entries(blockTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-text-gray mb-1 block">Порядок</label>
            <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
              className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-text-gray mb-1 block">Заголовок</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary" placeholder="Заголовок блока" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-text-gray mb-1 block">Подзаголовок / описание</label>
            <input type="text" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary" placeholder="Подзаголовок" />
          </div>
          <div>
            <label className="text-sm text-text-gray mb-1 block">Текст кнопки</label>
            <input type="text" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary" placeholder="Смотреть каталог" />
          </div>
          <div>
            <label className="text-sm text-text-gray mb-1 block">Ссылка кнопки</label>
            <input type="text" value={form.buttonLink} onChange={(e) => setForm({ ...form, buttonLink: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary" placeholder="/catalog/nagrevateli-tabaka" />
          </div>
          <div>
            <label className="text-sm text-text-gray mb-1 block">Изображение / анимация (PNG, WebM)</label>
            <div className="flex items-center gap-2">
              <button onClick={() => uploadImage("image")} className="bg-bg-light hover:bg-border text-text-dark px-4 py-2.5 rounded-lg text-sm transition-colors border border-border">
                Загрузить файл
              </button>
              {form.image && <span className="text-xs text-success truncate max-w-[200px]">{form.image}</span>}
            </div>
          </div>
          <div>
            <label className="text-sm text-text-gray mb-1 block">Фоновое изображение</label>
            <div className="flex items-center gap-2">
              <button onClick={() => uploadImage("bgImage")} className="bg-bg-light hover:bg-border text-text-dark px-4 py-2.5 rounded-lg text-sm transition-colors border border-border">
                Загрузить фон
              </button>
              {form.bgImage && <span className="text-xs text-success truncate max-w-[200px]">{form.bgImage}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} id="block-active" />
            <label htmlFor="block-active" className="text-sm text-text-gray">Активен</label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={save} className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-lg transition-colors font-medium">
            {editing ? "Сохранить" : "Добавить"}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(emptyBlock); }} className="bg-bg-light text-text-gray px-6 py-2.5 rounded-lg transition-colors border border-border">
              Отмена
            </button>
          )}
        </div>
      </div>

      {/* Block list */}
      <div className="bg-bg-white rounded-xl border border-border p-5">
        <h3 className="font-bold text-text-dark mb-4">Блоки ({blocks.length})</h3>
        {blocks.length === 0 ? <p className="text-text-gray text-sm">Нет блоков. Добавьте первый блок через форму выше.</p> : (
          <div className="space-y-3">
            {blocks.map((block) => (
              <div key={block.id} className="flex items-center justify-between p-4 bg-bg-light rounded-lg">
                <div className="flex items-center gap-4">
                  {block.image && (
                    /\.(webm|mp4)$/i.test(block.image) ? (
                      <video autoPlay loop muted playsInline className="w-16 h-16 object-contain rounded bg-white p-1">
                        <source src={block.image.startsWith("/api/") ? block.image : block.image.startsWith("/uploads/") ? `/api${block.image}` : block.image} />
                      </video>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={block.image.startsWith("/api/") ? block.image : block.image.startsWith("/uploads/") ? `/api${block.image}` : block.image} alt="" className="w-16 h-16 object-contain rounded bg-white p-1" />
                    )
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${block.active ? "bg-success text-white" : "bg-text-light text-white"}`}>
                        {blockTypeLabels[block.blockType] || block.blockType}
                      </span>
                      <span className="text-xs text-text-gray">#{block.order}</span>
                    </div>
                    <p className="font-medium text-text-dark text-sm mt-1">{block.title || "(без заголовка)"}</p>
                    {block.subtitle && <p className="text-xs text-text-gray">{block.subtitle}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(block)} className="text-sm px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition-colors">
                    Редактировать
                  </button>
                  <button onClick={() => remove(block.id)} className="text-sm px-3 py-1.5 rounded-lg border border-danger text-danger hover:bg-danger hover:text-white transition-colors">
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminsPanel({ token }: { token: string }) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [newAdmin, setNewAdmin] = useState({ username: "", password: "", role: "editor" });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/admins", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setAdmins(await res.json());
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newAdmin.username || !newAdmin.password) {
      setMsg("Ошибка: логин и пароль обязательны");
      return;
    }
    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(newAdmin),
    });
    if (res.ok) {
      setMsg("Администратор создан");
      setNewAdmin({ username: "", password: "", role: "editor" });
      load();
    } else {
      const err = await res.json();
      setMsg(`Ошибка: ${err.error}`);
    }
  };

  const toggleRole = async (admin: AdminUser) => {
    const newRole = admin.role === "admin" ? "editor" : "admin";
    await fetch("/api/admin/admins", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: admin.id, role: newRole }),
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить этого администратора?")) return;
    const res = await fetch(`/api/admin/admins?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      load();
    } else {
      const err = await res.json();
      setMsg(`Ошибка: ${err.error}`);
    }
  };

  if (loading) return <div className="text-center py-12 text-text-gray">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-text-dark">Управление администраторами</h2>
      {msg && <p className={`text-sm ${msg.includes("Ошибка") ? "text-danger" : "text-success"}`}>{msg}</p>}

      {/* New admin form */}
      <div className="bg-bg-white rounded-xl border border-border p-5">
        <h3 className="font-bold text-text-dark mb-4">Добавить администратора</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-text-gray mb-1 block">Логин</label>
            <input type="text" value={newAdmin.username} onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary" placeholder="login" />
          </div>
          <div>
            <label className="text-sm text-text-gray mb-1 block">Пароль</label>
            <input type="password" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary" placeholder="min 6 символов" />
          </div>
          <div>
            <label className="text-sm text-text-gray mb-1 block">Роль</label>
            <select value={newAdmin.role} onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary">
              <option value="editor">Редактор</option>
              <option value="admin">Администратор</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={create} className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-lg transition-colors font-medium w-full">
              Создать
            </button>
          </div>
        </div>
        <p className="text-xs text-text-gray mt-3"><strong>Администратор</strong> — полный доступ, может создавать других админов. <strong>Редактор</strong> — может редактировать контент сайта, но не управлять пользователями.</p>
      </div>

      {/* Admin list */}
      <div className="bg-bg-white rounded-xl border border-border p-5">
        <h3 className="font-bold text-text-dark mb-4">Список ({admins.length})</h3>
        <div className="space-y-3">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between p-4 bg-bg-light rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{admin.username.slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-medium text-text-dark">{admin.username}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${admin.role === "admin" ? "bg-accent text-white" : "bg-primary text-white"}`}>
                    {admin.role === "admin" ? "Администратор" : "Редактор"}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleRole(admin)} className="text-sm px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition-colors">
                  {admin.role === "admin" ? "Сделать редактором" : "Сделать админом"}
                </button>
                <button onClick={() => remove(admin.id)} className="text-sm px-3 py-1.5 rounded-lg border border-danger text-danger hover:bg-danger hover:text-white transition-colors">
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================ Отзывы ============================

interface AdminReview {
  id: string;
  authorName: string;
  userName: string;
  rating: number;
  text: string;
  published: boolean;
  source: string;
  isUser: boolean;
  createdAt: string;
}

interface ReviewProduct {
  id: string;
  name: string;
  slug: string;
  image: string;
  brand: string;
  productType: string;
  price: number;
  categoryName: string;
  reviews: AdminReview[];
}

function ReviewStars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="text-sm tracking-tight" title={`${rating} из 5`}>
      <span className="text-yellow-400">{"★".repeat(full)}</span>
      <span className="text-gray-300">{"★".repeat(5 - full)}</span>
    </span>
  );
}

const SOURCE_LABELS: Record<string, string> = { ai: "ИИ", import: "Импорт", manual: "Вручную", user: "Клиент" };
const SOURCE_COLORS: Record<string, string> = {
  ai: "bg-purple-100 text-purple-700",
  import: "bg-blue-100 text-blue-700",
  manual: "bg-gray-100 text-gray-700",
  user: "bg-green-100 text-green-700",
};

function ReviewsPanel({ token }: { token: string }) {
  const [products, setProducts] = useState<ReviewProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [geminiOn, setGeminiOn] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "missing" | "has">("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  const [formProductId, setFormProductId] = useState<string | null>(null);
  const [form, setForm] = useState({ authorName: "", rating: 5, text: "", date: "" });
  const [genLoading, setGenLoading] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [quickGenId, setQuickGenId] = useState<string | null>(null);

  const [bulkOnlyMissing, setBulkOnlyMissing] = useState(true);
  const [bulkPer, setBulkPer] = useState(1);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  const [impStep, setImpStep] = useState<"idle" | "mapping">("idle");
  const [impHeaders, setImpHeaders] = useState<string[]>([]);
  const [impMap, setImpMap] = useState<Record<string, string>>({});
  const [impSample, setImpSample] = useState<Record<string, string>[]>([]);
  const [impRows, setImpRows] = useState<Record<string, string>[]>([]);
  const [impLoading, setImpLoading] = useState(false);
  const [impMsg, setImpMsg] = useState("");

  const authHdr = { Authorization: `Bearer ${token}` };
  const jsonHdr = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    const res = await fetch("/api/admin/reviews", { headers: authHdr });
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
    fetch("/api/admin/reviews/generate", { headers: authHdr })
      .then((r) => (r.ok ? r.json() : { gemini: false }))
      .then((d) => setGeminiOn(Boolean(d.gemini)))
      .catch(() => setGeminiOn(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openForm = (p: ReviewProduct) => {
    setFormProductId(formProductId === p.id ? null : p.id);
    setForm({ authorName: "", rating: 5, text: "", date: "" });
  };

  const generateDraft = async (p: ReviewProduct) => {
    setGenLoading(true);
    try {
      const res = await fetch("/api/admin/reviews/generate", {
        method: "POST",
        headers: jsonHdr,
        body: JSON.stringify({ productId: p.id, rating: form.rating || undefined, authorName: form.authorName || undefined }),
      });
      if (res.ok) {
        const d = await res.json();
        setForm((f) => ({ ...f, authorName: d.authorName, rating: d.rating, text: d.text }));
      }
    } finally {
      setGenLoading(false);
    }
  };

  const applyForm = async (productId: string) => {
    if (!form.text.trim()) return;
    setSavingForm(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: jsonHdr,
        body: JSON.stringify({ productId, authorName: form.authorName, rating: form.rating, text: form.text, source: "manual", createdAt: form.date || undefined }),
      });
      if (res.ok) {
        setFormProductId(null);
        await load();
      }
    } finally {
      setSavingForm(false);
    }
  };

  const quickGenerate = async (p: ReviewProduct) => {
    setQuickGenId(p.id);
    try {
      const gen = await fetch("/api/admin/reviews/generate", {
        method: "POST",
        headers: jsonHdr,
        body: JSON.stringify({ productId: p.id }),
      });
      if (gen.ok) {
        const d = await gen.json();
        await fetch("/api/admin/reviews", {
          method: "POST",
          headers: jsonHdr,
          body: JSON.stringify({ productId: p.id, authorName: d.authorName, rating: d.rating, text: d.text, source: "ai" }),
        });
        await load();
      }
    } finally {
      setQuickGenId(null);
    }
  };

  const togglePublished = async (r: AdminReview) => {
    await fetch("/api/admin/reviews", { method: "PATCH", headers: jsonHdr, body: JSON.stringify({ id: r.id, published: !r.published }) });
    await load();
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Удалить отзыв?")) return;
    await fetch("/api/admin/reviews", { method: "DELETE", headers: jsonHdr, body: JSON.stringify({ id }) });
    await load();
  };

  const openGoogle = (p: ReviewProduct) => {
    const q = `Напиши правдоподобный отзыв покупателя на товар "${p.name}" для интернет-магазина, 2-3 предложения, от первого лица`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank");
  };

  const runBulk = async () => {
    const scope = bulkOnlyMissing ? "товаров без отзывов" : "ВСЕХ товаров";
    if (!confirm(`Сгенерировать и применить отзывы для ${scope}? Будет создано по ${bulkPer} отзыв(а) на товар.`)) return;
    setBulkLoading(true);
    setBulkMsg("");
    try {
      const res = await fetch("/api/admin/reviews/generate", {
        method: "POST",
        headers: jsonHdr,
        body: JSON.stringify({ bulk: true, onlyMissing: bulkOnlyMissing, perProduct: bulkPer }),
      });
      const d = await res.json();
      if (res.ok) {
        setBulkMsg(`Готово: создано ${d.created} отзывов для ${d.productsProcessed} товаров${d.engine === "gemini" ? " (нейросеть Google)" : " (локальный генератор)"}.`);
        await load();
      } else {
        setBulkMsg(`Ошибка: ${d.error || "не удалось"}`);
      }
    } catch {
      setBulkMsg("Ошибка сети");
    } finally {
      setBulkLoading(false);
    }
  };

  const REVIEW_FIELDS = [
    { value: "", label: "— Пропустить —" },
    { value: "product", label: "Товар (название/артикул)" },
    { value: "author", label: "Автор" },
    { value: "rating", label: "Оценка" },
    { value: "text", label: "Текст отзыва" },
    { value: "date", label: "Дата" },
    { value: "published", label: "Опубликован" },
  ];

  const handleImportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImpLoading(true);
    setImpMsg("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/reviews/import", { method: "PUT", headers: authHdr, body: fd });
      const d = await res.json();
      if (res.ok) {
        setImpHeaders(d.headers);
        setImpMap(d.autoMap);
        setImpSample(d.sample);
        setImpRows(d.rows);
        setImpStep("mapping");
        setImpMsg(`Найдено строк: ${d.totalRows}`);
      } else {
        setImpMsg(`Ошибка: ${d.error}`);
      }
    } catch {
      setImpMsg("Ошибка загрузки файла");
    } finally {
      setImpLoading(false);
      e.target.value = "";
    }
  };

  const commitImport = async () => {
    const mapped = impRows.map((row) => {
      const o: Record<string, string> = {};
      for (const [header, field] of Object.entries(impMap)) {
        if (field) o[field] = row[header] ?? "";
      }
      return o;
    });
    setImpLoading(true);
    setImpMsg("");
    try {
      const res = await fetch("/api/admin/reviews/import", { method: "POST", headers: jsonHdr, body: JSON.stringify({ reviews: mapped }) });
      const d = await res.json();
      if (res.ok) {
        setImpMsg(`Импортировано ${d.imported} из ${d.total}. Товаров не найдено: ${d.notFoundCount}${d.notFound?.length ? ` (${d.notFound.slice(0, 5).join(", ")}${d.notFoundCount > 5 ? "…" : ""})` : ""}. Пропущено: ${d.skipped}.`);
        setImpStep("idle");
        setImpHeaders([]);
        setImpRows([]);
        await load();
      } else {
        setImpMsg(`Ошибка: ${d.error}`);
      }
    } catch {
      setImpMsg("Ошибка импорта");
    } finally {
      setImpLoading(false);
    }
  };

  const resetImport = () => {
    setImpStep("idle");
    setImpHeaders([]);
    setImpRows([]);
    setImpMap({});
    setImpMsg("");
  };

  const downloadTemplate = async () => {
    const res = await fetch("/api/admin/reviews/import", { headers: authHdr });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reviews-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "missing" && p.reviews.length > 0) return false;
    if (filter === "has" && p.reviews.length === 0) return false;
    return true;
  });
  const totalReviews = products.reduce((s, p) => s + p.reviews.length, 0);
  const missingCount = products.filter((p) => p.reviews.length === 0).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);
  const mappingValid = Object.values(impMap).includes("product") && Object.values(impMap).includes("text");

  if (loading) return <p className="text-text-gray">Загрузка...</p>;

  return (
    <div className="space-y-6">
      {/* Заголовок и статус нейросети */}
      <div className="bg-bg-white rounded-xl border border-border p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-text-dark">Отзывы</h2>
            <p className="text-sm text-text-gray mt-1">
              Всего товаров: {products.length} · отзывов: {totalReviews} · без отзывов: {missingCount}
            </p>
          </div>
          {geminiOn !== null && (
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${geminiOn ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
              {geminiOn ? "✨ Нейросеть Google подключена" : "Локальный генератор (без ключа Google)"}
            </span>
          )}
        </div>
      </div>

      {/* Массовая генерация */}
      <div className="bg-bg-white rounded-xl border border-border p-5">
        <h3 className="font-bold text-text-dark mb-2">Сгенерировать отзывы для товаров</h3>
        <p className="text-sm text-text-gray mb-3">
          Нейросеть создаст отзыв от имени случайного покупателя (например, «Василий А.») для каждого товара и сразу применит его.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text-dark cursor-pointer">
            <input type="checkbox" checked={bulkOnlyMissing} onChange={(e) => setBulkOnlyMissing(e.target.checked)} className="accent-primary w-4 h-4" />
            Только товары без отзывов
          </label>
          <label className="flex items-center gap-2 text-sm text-text-dark">
            Отзывов на товар:
            <input type="number" min={1} max={5} value={bulkPer} onChange={(e) => setBulkPer(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
              className="w-16 border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary" />
          </label>
          <button onClick={runBulk} disabled={bulkLoading}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition-all">
            {bulkLoading ? "Генерация…" : "Сгенерировать и применить"}
          </button>
          {bulkMsg && <span className="text-sm text-text-dark">{bulkMsg}</span>}
        </div>
      </div>

      {/* Импорт через таблицу */}
      <div className="bg-bg-white rounded-xl border border-border p-5">
        <h3 className="font-bold text-text-dark mb-2">Загрузка отзывов через таблицу</h3>
        <p className="text-sm text-text-gray mb-3">
          Загрузите XLSX/CSV с колонками: Товар (название или артикул), Автор, Оценка, Текст отзыва, Дата, Опубликован.
          Отзывы привяжутся к уже существующим товарам по названию, артикулу или штрихкоду.
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button onClick={downloadTemplate} className="inline-flex items-center gap-2 border border-border text-text-dark text-sm px-4 py-2 rounded-lg hover:bg-bg-light transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Скачать шаблон
          </button>
          <label className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm px-4 py-2 rounded-lg cursor-pointer transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            {impStep !== "idle" ? "Загрузить другой файл" : "Выбрать файл"}
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImportUpload} className="hidden" />
          </label>
          {impStep !== "idle" && <button onClick={resetImport} className="text-sm text-danger hover:underline">Отмена</button>}
          {impLoading && <span className="text-sm text-text-gray">Обработка…</span>}
          {impMsg && <span className="text-sm text-text-dark">{impMsg}</span>}
        </div>

        {impStep === "mapping" && impHeaders.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-bold text-text-dark mb-2">Настройте соответствие колонок</h4>
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Колонка файла</th>
                    <th className="px-3 py-2 text-left">Поле отзыва</th>
                    <th className="px-3 py-2 text-left">Пример</th>
                  </tr>
                </thead>
                <tbody>
                  {impHeaders.map((header) => (
                    <tr key={header} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{header}</td>
                      <td className="px-3 py-2">
                        <select value={impMap[header] || ""} onChange={(e) => setImpMap({ ...impMap, [header]: e.target.value })}
                          className="border border-border rounded px-2 py-1 text-sm w-full max-w-[220px] focus:outline-none focus:border-primary">
                          {REVIEW_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-text-gray text-xs max-w-[240px] truncate">
                        {impSample.map((s, i) => <span key={i}>{i > 0 && " | "}{s[header] || "—"}</span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={commitImport} disabled={impLoading || !mappingValid}
                className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                Импортировать {impRows.length} отзыв(ов)
              </button>
              {!mappingValid && <span className="text-xs text-danger">Укажите колонки «Товар» и «Текст отзыва»</span>}
            </div>
          </div>
        )}
      </div>

      {/* Фильтры */}
      <div className="bg-bg-white rounded-xl border border-border p-4 flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Поиск по названию товара" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        <select value={filter} onChange={(e) => { setFilter(e.target.value as "all" | "missing" | "has"); setPage(1); }}
          className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
          <option value="all">Все товары</option>
          <option value="missing">Без отзывов</option>
          <option value="has">С отзывами</option>
        </select>
      </div>

      {/* Список товаров */}
      {pageItems.length === 0 ? (
        <p className="text-text-gray text-sm">Товары не найдены</p>
      ) : (
        <div className="space-y-4">
          {pageItems.map((p) => {
            const avg = p.reviews.length ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : 0;
            const isFormOpen = formProductId === p.id;
            return (
              <div key={p.id} className="bg-bg-white rounded-xl border border-border p-5">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="w-14 h-14 rounded-lg bg-bg-light overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">📦</span>}
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-medium text-text-dark">{p.name}</p>
                    <p className="text-xs text-text-gray">{p.categoryName}{p.brand ? ` · ${p.brand}` : ""}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {p.reviews.length > 0 ? (
                        <>
                          <ReviewStars rating={avg} />
                          <span className="text-xs text-text-gray">{avg.toFixed(1)} · {p.reviews.length} отзыв(ов)</span>
                        </>
                      ) : (
                        <span className="text-xs text-text-light">Отзывов пока нет</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => quickGenerate(p)} disabled={quickGenId === p.id} title="Сгенерировать отзыв нейросетью и сразу применить"
                      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                      {quickGenId === p.id ? "…" : "Сгенерировать"}
                    </button>
                    <button onClick={() => openForm(p)} className="text-sm px-3 py-1.5 rounded-lg border border-border text-text-gray hover:bg-bg-light transition-colors">
                      {isFormOpen ? "Скрыть" : "Добавить"}
                    </button>
                  </div>
                </div>

                {/* Форма добавления / генерации с редактированием */}
                {isFormOpen && (
                  <div className="mt-4 border-t border-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Имя автора (напр. Василий А.)" value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                        className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                      <select value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                        className="border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-primary">
                        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                      </select>
                    </div>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-text-gray" />
                    <div className="md:col-span-2 relative">
                      <textarea placeholder="Текст отзыва" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={3}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary pr-10" />
                      <button type="button" title="Открыть поиск Google для написания отзыва" onClick={() => openGoogle(p)}
                        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg border border-border text-text-gray hover:bg-bg-light">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
                      </button>
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => generateDraft(p)} disabled={genLoading}
                        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                        {genLoading ? "Генерация…" : "Сгенерировать черновик"}
                      </button>
                      <button type="button" onClick={() => applyForm(p.id)} disabled={savingForm || !form.text.trim()}
                        className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition-colors">
                        {savingForm ? "Сохранение…" : "Применить"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Существующие отзывы */}
                {p.reviews.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3 space-y-2">
                    {p.reviews.map((r) => (
                      <div key={r.id} className={`flex items-start justify-between gap-3 p-3 rounded-lg ${r.published ? "bg-bg-light" : "bg-bg-light/50 opacity-60"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-text-dark text-sm">{r.userName || "Аноним"}</span>
                            <ReviewStars rating={r.rating} />
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${SOURCE_COLORS[r.source] || "bg-gray-100 text-gray-600"}`}>{SOURCE_LABELS[r.source] || r.source}</span>
                            {!r.published && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Скрыт</span>}
                            <span className="text-[10px] text-text-light">{new Date(r.createdAt).toLocaleDateString("ru-RU")}</span>
                          </div>
                          {r.text && <p className="text-sm text-text-gray mt-1 whitespace-pre-line">{r.text}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => togglePublished(r)} className="text-xs text-primary hover:underline">
                            {r.published ? "Скрыть" : "Показать"}
                          </button>
                          <button onClick={() => deleteReview(r.id)} className="text-xs text-danger hover:underline">Удалить</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Пагинация */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={curPage <= 1}
            className="px-3 py-1.5 rounded-lg border border-border text-sm text-text-gray disabled:opacity-40 hover:bg-bg-light">Назад</button>
          <span className="text-sm text-text-gray">Стр. {curPage} из {pageCount}</span>
          <button onClick={() => setPage((n) => Math.min(pageCount, n + 1))} disabled={curPage >= pageCount}
            className="px-3 py-1.5 rounded-lg border border-border text-sm text-text-gray disabled:opacity-40 hover:bg-bg-light">Вперёд</button>
        </div>
      )}
    </div>
  );
}
