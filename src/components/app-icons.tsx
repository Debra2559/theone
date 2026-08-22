import type { ComponentProps } from "react";
import {
  SparklesRegular,
  HeartRegular,
  Message3Regular,
  User1Regular,
  CheckRegular,
  RightRegular,
  LeftRegular,
  Book2Regular,
  Refresh1Regular,
  RefreshAnticlockwise1Regular,
  MapPinRegular,
  CakeRegular,
  PencilRegular,
  ExitDoorRegular,
  CloseRegular,
  DownloadRegular,
  Share2Regular,
  Delete2Regular,
  PlusRegular,
  MailRegular,
  LockRegular,
  GoogleRegular,
  Loading3Regular,
  SearchRegular,
  Filter2Regular,
} from "@mingcute/react/core-regular";
import { HeartFilled as HeartFilledIcon } from "@mingcute/react/core-filled";
import { cn } from "@/lib/utils";

export const Sparkles = SparklesRegular;
export const Heart = HeartRegular;
export const HeartFilled = HeartFilledIcon;
export const MessageCircleHeart = Message3Regular;
export const CircleUserRound = User1Regular;
export const Check = CheckRegular;
export const ChevronRight = RightRegular;
export const BookOpen = Book2Regular;
export const ArrowRight = RightRegular;
export const ArrowLeft = LeftRegular;
export const RotateCcw = RefreshAnticlockwise1Regular;
export const RefreshCw = Refresh1Regular;
export const MapPin = MapPinRegular;
export const Cake = CakeRegular;
export const Pencil = PencilRegular;
export const LogOut = ExitDoorRegular;
export const X = CloseRegular;
export const Download = DownloadRegular;
export const Share2 = Share2Regular;
export const Trash2 = Delete2Regular;
export const Plus = PlusRegular;
export const Mail = MailRegular;
export const Lock = LockRegular;
export const Chrome = GoogleRegular;
export const Search = SearchRegular;
export const Filter = Filter2Regular;

export function Loader2({ className, ...props }: ComponentProps<typeof Loading3Regular>) {
  return <Loading3Regular className={cn("animate-spin", className)} {...props} />;
}
