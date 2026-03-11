/**
 * Icon Adapter Layer - Lucide to Heroicons Migration
 *
 * This module provides backward-compatible icon exports that map
 * Lucide React icon names to their Heroicons equivalents.
 *
 * @version 2.0.0
 * @updated 2026-01-16
 *
 * Usage:
 * - Replace: import { Sparkles, Check } from 'lucide-react'
 * - With:    import { Sparkles, Check } from '@/components/icons'
 */

// ============================================
// HEROICONS - Direct Mappings (24/outline)
// ============================================

export {
  // A
  ChartBarIcon as Activity,
  ExclamationCircleIcon as AlertCircle,
  ExclamationTriangleIcon as AlertTriangle,
  Bars3CenterLeftIcon as AlignCenter,
  Bars3BottomLeftIcon as AlignLeft,
  Bars3BottomRightIcon as AlignRight,
  ArchiveBoxIcon as Archive,
  ArrowDownIcon as ArrowDown,
  ArrowDownRightIcon as ArrowDownRight,
  ArrowRightIcon as ArrowRight,
  ArrowUpIcon as ArrowUp,
  ArrowUpRightIcon as ArrowUpRight,
  AtSymbolIcon as AtSign,
  TrophyIcon as Award,

  // B
  CheckBadgeIcon as BadgeCheck,
  ChartBarIcon as BarChart,
  ChartBarIcon as BarChart2,
  ChartBarIcon as BarChart3,
  BellIcon as Bell,
  BellSlashIcon as BellOff,

  // B (continued)
  BookmarkIcon as Bookmark,

  // C
  CalendarIcon as Calendar,
  CalendarDaysIcon as CalendarDays,
  CameraIcon as Camera,
  CheckIcon as Check,
  CheckCircleIcon as CheckCircle,
  CheckCircleIcon as CheckCircle2,
  ChevronDownIcon as ChevronDown,
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
  ChevronUpIcon as ChevronUp,
  StopIcon as Circle,
  CloudIcon as Cloud,
  CodeBracketIcon as Code,
  CommandLineIcon as Command,
  ComputerDesktopIcon as Monitor,
  DocumentDuplicateIcon as Copy,
  CpuChipIcon as Cpu,

  // D
  CircleStackIcon as Database,
  CurrencyDollarIcon as DollarSign,
  ArrowDownTrayIcon as Download,

  // E
  PencilIcon as Edit,
  PencilSquareIcon as Edit3,
  EyeIcon as Eye,
  EyeSlashIcon as EyeOff,

  // F-G
  GiftIcon as Gift,
  DocumentIcon as File,
  CodeBracketSquareIcon as FileCode,
  DocumentMagnifyingGlassIcon as FileSearch,
  DocumentTextIcon as FileText,
  FunnelIcon as Filter,
  BeakerIcon as FlaskConical,
  FaceFrownIcon as Frown,

  // G
  GlobeAltIcon as Globe,
  Squares2X2Icon as Grid,

  // H
  HashtagIcon as Hash,
  HeartIcon as Heart,
  HomeIcon as Home,

  // I
  PhotoIcon as Image,
  PhotoIcon as ImageIcon,
  InformationCircleIcon as Info,

  // K
  CommandLineIcon as Keyboard,

  // L
  LanguageIcon as Languages,
  FaceSmileIcon as Laugh,
  RectangleGroupIcon as Layout,
  LightBulbIcon as Lightbulb,
  PresentationChartLineIcon as LineChart,
  LinkIcon as Link,
  LinkIcon as Link2,
  ListBulletIcon as List,
  NumberedListIcon as ListOrdered,
  ClipboardDocumentListIcon as ListTodo,
  ArrowPathIcon as Loader2,
  ArrowRightOnRectangleIcon as LogOut,

  // L (continued)
  Square2StackIcon as Layers,

  // M
  EnvelopeIcon as Mail,
  MapIcon as Map,
  FaceSmileIcon as Meh,
  Bars3Icon as Menu,
  ChatBubbleLeftIcon as MessageCircle,
  ChatBubbleLeftRightIcon as MessageSquare,
  MicrophoneIcon as Mic,
  MinusIcon as Minus,
  EllipsisHorizontalIcon as MoreHorizontal,
  EllipsisVerticalIcon as MoreVertical,
  CursorArrowRaysIcon as MousePointer,
  ArrowsPointingOutIcon as Move,
  MusicalNoteIcon as Music,

  // P
  SwatchIcon as Palette,
  PaperClipIcon as Paperclip,
  PauseIcon as Pause,
  ChartPieIcon as PieChart,
  Bars3BottomLeftIcon as Pilcrow,
  PlayIcon as Play,
  PlusIcon as Plus,
  PrinterIcon as Printer,

  // Q
  ChatBubbleBottomCenterTextIcon as Quote,

  // R
  StopIcon as RadioButton,
  ArrowUturnRightIcon as Redo,
  ArrowPathIcon as RefreshCw,
  ArrowPathRoundedSquareIcon as Repeat,
  ArrowUturnLeftIcon as Reply,
  RocketLaunchIcon as Rocket,
  TableCellsIcon as Rows,

  // S
  MagnifyingGlassIcon as Search,
  PaperAirplaneIcon as Send,
  Cog6ToothIcon as Settings,
  ShareIcon as Share2,
  ShieldCheckIcon as Shield,
  DevicePhoneMobileIcon as Smartphone,
  ForwardIcon as SkipForward,
  FaceSmileIcon as Smile,
  SparklesIcon as Sparkles,
  StarIcon as Star,
  StrikethroughIcon as Strikethrough,
  BookmarkSquareIcon as Save,

  // T
  TableCellsIcon as Table,
  DeviceTabletIcon as Tablet,
  DocumentTextIcon as Textarea,
  HandThumbDownIcon as ThumbsDown,
  HandThumbUpIcon as ThumbsUp,
  TrashIcon as Trash2,
  ArrowTrendingDownIcon as TrendingDown,
  ArrowTrendingUpIcon as TrendingUp,
  LanguageIcon as Type,

  // U
  ArrowUturnLeftIcon as Undo,
  ArrowUpTrayIcon as Upload,
  UserIcon as User,
  UserGroupIcon as Users,

  // V
  VideoCameraIcon as Video,
  SpeakerWaveIcon as Volume2,

  // W
  SparklesIcon as Wand2,

  // X
  XMarkIcon as X,
  XCircleIcon as XCircle,

  // Z
  BoltIcon as Zap,

  // Additional mappings for missing icons
  ExclamationTriangleIcon as AlertOctagon,
  ArrowLeftIcon as ArrowLeft,
  NoSymbolIcon as Ban,
  BeakerIcon as Beaker,
  BookOpenIcon as Book,
  BookOpenIcon as BookOpen,
  CpuChipIcon as Bot,
  BriefcaseIcon as Briefcase,
  BugAntIcon as Bug,
  BuildingOfficeIcon as Building,
  BuildingOffice2Icon as Building2,
  CalculatorIcon as Calculator,
  CurrencyDollarIcon as Coins,
  CreditCardIcon as CreditCard,
  SparklesIcon as Diamond,
  ArrowTopRightOnSquareIcon as ExternalLink,
  FlagIcon as Flag,
  FireIcon as Flame,
  CodeBracketSquareIcon as GitBranch,
  ServerStackIcon as HardDrive,
  QuestionMarkCircleIcon as HelpCircle,
  PhotoIcon as ImageOff,
  InboxIcon as Inbox,
  KeyIcon as Key,
  MapPinIcon as MapPin,
  ArrowsPointingOutIcon as Maximize2,
  MegaphoneIcon as Megaphone,
  CpuChipIcon as MemoryStick,
  ArrowsPointingInIcon as Minimize2,
  MoonIcon as Moon,
  CubeIcon as Package,
  PhoneIcon as Phone,
  ArrowPathIcon as RotateCcw,
  ScaleIcon as Scale,
  ServerIcon as Server,
  ShoppingCartIcon as ShoppingCart,
  StopIcon as Square,
  SunIcon as Sun,
  TrophyIcon as Trophy,
  UserPlusIcon as UserPlus,
  WifiIcon as Wifi,
  SignalSlashIcon as WifiOff,
  MagnifyingGlassPlusIcon as ZoomIn,
  LockClosedIcon as Lock,
  GlobeAltIcon as Chrome,
  LinkSlashIcon as Unlink,
  BookmarkIcon as BookmarkPlus,
  Cog8ToothIcon as Settings2,
  CodeBracketIcon as Code2,
  NewspaperIcon as Newspaper,
} from '@heroicons/react/24/outline';

// ============================================
// HEROICONS - Solid variants for filled icons
// ============================================

export {
  StarIcon as StarSolid,
  HeartIcon as HeartSolid,
  CheckCircleIcon as CheckCircleSolid,
  BellIcon as BellSolid,
} from '@heroicons/react/24/solid';

// ============================================
// CUSTOM ICONS (Not available in Heroicons)
// ============================================

export { Brain } from './custom/Brain';
export { BrainCircuit } from './custom/BrainCircuit';
export { Crown } from './custom/Crown';
export { Target } from './custom/Target';

// ============================================
// SOCIAL MEDIA ICONS (via react-icons)
// ============================================

export {
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Github,
  Reddit,
  Pinterest,
  Threads,
} from './social';

// ============================================
// TYPOGRAPHY ICONS (Custom implementations)
// ============================================

export { Bold } from './custom/Bold';
export { Italic } from './custom/Italic';
export { Heading1 } from './custom/Heading1';
export { Heading2 } from './custom/Heading2';
export { Heading3 } from './custom/Heading3';

// ============================================
// COLUMN ICON (Not in Heroicons)
// ============================================

export { Columns } from './custom/Columns';
export { GripVertical } from './custom/GripVertical';
export { ToggleLeft } from './custom/ToggleLeft';
export { ToggleRight } from './custom/ToggleRight';
export { Percent } from './custom/Percent';

// ============================================
// CLOCK ICON (Alias)
// ============================================

export { ClockIcon as Clock } from '@heroicons/react/24/outline';

// ============================================
// LUCIDE-REACT DIRECT EXPORTS (No Heroicons equivalent)
// ============================================

export { FileQuestion } from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type IconProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  size?: number | string;
};

// ============================================
// ICON SIZE PRESETS (matching design tokens)
// ============================================

export const IconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
} as const;

// ============================================
// HELPER: Apply size to icon
// ============================================

export function getIconSize(size: keyof typeof IconSizes | number): number {
  if (typeof size === 'number') return size;
  return IconSizes[size] ?? IconSizes.md;
}
