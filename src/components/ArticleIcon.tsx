import {
  BookOpen, Rocket, Settings, Users, Zap, Shield, Key, Lock, Mail, MessageCircle,
  MessageSquare, Phone, PhoneCall, Smartphone, Send, Bell, Bot, Brain, Sparkles,
  Star, Heart, Flag, Bookmark, Tag, Tags, Folder, FolderOpen, File, FileText,
  FileCode, Code, Terminal, Database, Server, Cloud, CloudUpload, CloudDownload,
  Download, Upload, Link as LinkIcon, ExternalLink, Globe, Home, Building, Store,
  ShoppingCart, ShoppingBag, CreditCard, DollarSign, Receipt, Wallet, BarChart,
  BarChart2, BarChart3, LineChart, PieChart, TrendingUp, Activity, Calendar,
  Clock, Timer, CheckCircle, Check, X, AlertCircle, AlertTriangle, Info,
  HelpCircle, Search, Filter, List, Grid, Layout, LayoutDashboard, Layers,
  Package, Box, Truck, MapPin, Map, Navigation, Compass, Image, Camera, Video,
  Mic, Music, Headphones, PlayCircle, Palette, Paintbrush, Wrench, PenTool,
  Edit, Trash, Plus, Minus, RefreshCw, RotateCw, Share2, Copy, Save, Eye,
  EyeOff, User, UserPlus, UserCheck, Users2, Briefcase, GraduationCap, Award,
  Gift, Puzzle, Plug, Workflow, GitBranch, Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ARTICLE_ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen, rocket: Rocket, settings: Settings, users: Users, zap: Zap,
  shield: Shield, key: Key, lock: Lock, mail: Mail, "message-circle": MessageCircle,
  "message-square": MessageSquare, phone: Phone, "phone-call": PhoneCall,
  smartphone: Smartphone, send: Send, bell: Bell, bot: Bot, brain: Brain,
  sparkles: Sparkles, star: Star, heart: Heart, flag: Flag, bookmark: Bookmark,
  tag: Tag, tags: Tags, folder: Folder, "folder-open": FolderOpen, file: File,
  "file-text": FileText, "file-code": FileCode, code: Code, terminal: Terminal,
  database: Database, server: Server, cloud: Cloud, "cloud-upload": CloudUpload,
  "cloud-download": CloudDownload, download: Download, upload: Upload,
  link: LinkIcon, "external-link": ExternalLink, globe: Globe, home: Home,
  building: Building, store: Store, "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag, "credit-card": CreditCard, "dollar-sign": DollarSign,
  receipt: Receipt, wallet: Wallet, "bar-chart": BarChart, "bar-chart-2": BarChart2,
  "bar-chart-3": BarChart3, "line-chart": LineChart, "pie-chart": PieChart,
  "trending-up": TrendingUp, activity: Activity, calendar: Calendar, clock: Clock,
  timer: Timer, "check-circle": CheckCircle, check: Check, x: X,
  "alert-circle": AlertCircle, "alert-triangle": AlertTriangle, info: Info,
  "help-circle": HelpCircle, search: Search, filter: Filter, list: List,
  grid: Grid, layout: Layout, "layout-dashboard": LayoutDashboard, layers: Layers,
  package: Package, box: Box, truck: Truck, "map-pin": MapPin, map: Map,
  navigation: Navigation, compass: Compass, image: Image, camera: Camera,
  video: Video, mic: Mic, music: Music, headphones: Headphones,
  "play-circle": PlayCircle, palette: Palette, paintbrush: Paintbrush,
  wrench: Wrench, "pen-tool": PenTool, edit: Edit, trash: Trash, plus: Plus,
  minus: Minus, "refresh-cw": RefreshCw, "rotate-cw": RotateCw, share: Share2,
  copy: Copy, save: Save, eye: Eye, "eye-off": EyeOff, user: User,
  "user-plus": UserPlus, "user-check": UserCheck, "users-2": Users2,
  briefcase: Briefcase, "graduation-cap": GraduationCap, award: Award, gift: Gift,
  puzzle: Puzzle, plug: Plug, workflow: Workflow, "git-branch": GitBranch,
  webhook: Webhook,
};

export const ARTICLE_ICON_NAMES = Object.keys(ARTICLE_ICONS).sort();

export function ArticleIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  if (!name) return null;
  const Cmp = ARTICLE_ICONS[name];
  if (!Cmp) return null;
  return <Cmp className={className} />;
}
