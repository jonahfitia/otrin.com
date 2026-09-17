import type { SvgIconComponent } from '@mui/icons-material';
import Payments from '@mui/icons-material/Payments';
import Savings from '@mui/icons-material/Savings';
import CardGiftcard from '@mui/icons-material/CardGiftcard';
import Help from '@mui/icons-material/Help';
import Church from '@mui/icons-material/Church';
import Home from '@mui/icons-material/Home';
import DirectionsBus from '@mui/icons-material/DirectionsBus';
import SyncAlt from '@mui/icons-material/SyncAlt';
import Restaurant from '@mui/icons-material/Restaurant';
import FolderOpen from '@mui/icons-material/FolderOpen';
import Phone from '@mui/icons-material/Phone';
import SportsSoccer from '@mui/icons-material/SportsSoccer';
import ShoppingBasket from '@mui/icons-material/ShoppingBasket';
import WarningAmber from '@mui/icons-material/WarningAmber';
import AccountBalanceWallet from '@mui/icons-material/AccountBalanceWallet';
import VolunteerActivism from '@mui/icons-material/VolunteerActivism';
import TrendingUp from '@mui/icons-material/TrendingUp';
import TrendingDown from '@mui/icons-material/TrendingDown';
import School from '@mui/icons-material/School';
import Work from '@mui/icons-material/Work';
import FitnessCenter from '@mui/icons-material/FitnessCenter';
import MusicNote from '@mui/icons-material/MusicNote';
import Movie from '@mui/icons-material/Movie';
import Pets from '@mui/icons-material/Pets';
import ShoppingBag from '@mui/icons-material/ShoppingBag';
import Build from '@mui/icons-material/Build';
import LocalGroceryStore from '@mui/icons-material/LocalGroceryStore';
import Flight from '@mui/icons-material/Flight';
import Wifi from '@mui/icons-material/Wifi';
import Bolt from '@mui/icons-material/Bolt';
import WaterDrop from '@mui/icons-material/WaterDrop';
import Send from '@mui/icons-material/Send';
import Star from '@mui/icons-material/Star';
import Lightbulb from '@mui/icons-material/Lightbulb';
import Favorite from '@mui/icons-material/Favorite';
import Tag from '@mui/icons-material/Tag';
import ShoppingCart from '@mui/icons-material/ShoppingCart';
import BusinessCenter from '@mui/icons-material/BusinessCenter';
import HealthAndSafety from '@mui/icons-material/HealthAndSafety';
import MoreHoriz from '@mui/icons-material/MoreHoriz';

export const ICON_PALETTE: Record<string, SvgIconComponent> = {
  Payments,
  Savings,
  TrendingUp,
  TrendingDown,
  CardGiftcard,
  ShoppingBasket,
  ShoppingCart,
  ShoppingBag,
  LocalGroceryStore,
  Restaurant,
  Home,
  DirectionsBus,
  SyncAlt,
  Wifi,
  Bolt,
  WaterDrop,
  FolderOpen,
  Phone,
  Send,
  AccountBalanceWallet,
  Church,
  Help,
  SportsSoccer,
  FitnessCenter,
  MusicNote,
  Movie,
  Pets,
  Work,
  BusinessCenter,
  School,
  HealthAndSafety,
  WarningAmber,
  Build,
  Flight,
  VolunteerActivism,
  Favorite,
  Star,
  Lightbulb,
  Tag,
  MoreHoriz,
};

export const ICON_BY_NAME: Record<string, string> = {
  salaire: 'Payments',
  investissement: 'Savings',
  cadeau: 'CardGiftcard',
  'source oublié': 'Help',
  'source oublie': 'Help',
  dieu: 'Church',
  logement: 'Home',
  transport: 'DirectionsBus',
  abonnement: 'SyncAlt',
  alimentations: 'Restaurant',
  administratifs: 'FolderOpen',
  communication: 'Phone',
  loisirs: 'SportsSoccer',
  besoins: 'ShoppingBasket',
  'imprévues': 'WarningAmber',
  'imprevues': 'WarningAmber',
  dettes: 'AccountBalanceWallet',
  dons: 'VolunteerActivism',
};

export const DEFAULT_ICON = 'Tag';

export function getCategoryIcon(icon: string | null | undefined, name: string): SvgIconComponent {
  if (icon && ICON_PALETTE[icon]) return ICON_PALETTE[icon];
  const key = (name ?? '').trim().toLowerCase();
  const mapped = ICON_BY_NAME[key];
  if (mapped && ICON_PALETTE[mapped]) return ICON_PALETTE[mapped];
  return ICON_PALETTE[DEFAULT_ICON];
}

export function resolveIconSelector(key: string): SvgIconComponent {
  return ICON_PALETTE[key] ?? ICON_PALETTE[DEFAULT_ICON];
}