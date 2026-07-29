import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLUB_TYPES } from "@/types/club";

export type SortKey = "featured" | "newest" | "members" | "az";

type Props = {
  q: string;
  onQ: (v: string) => void;
  type: string;
  onType: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  onCreate: () => void;
  total: number;
};

export const ClubsFilterBar = ({ q, onQ, type, onType, sort, onSort, onCreate, total }: Props) => (
  <div className="sticky top-0 z-30 -mx-4 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
    <div className="abr-container flex flex-wrap items-center gap-3 px-0">
      <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Search clubs, promoters, tags…"
          className="h-11 rounded-full pl-9"
          aria-label="Search clubs"
        />
      </div>

      <Select value={type} onValueChange={onType}>
        <SelectTrigger className="h-11 w-[160px] rounded-full" aria-label="Filter by club type">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {CLUB_TYPES.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(v) => onSort(v as SortKey)}>
        <SelectTrigger className="h-11 w-[160px] rounded-full" aria-label="Sort clubs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="featured">Featured</SelectItem>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="members">Most Members</SelectItem>
          <SelectItem value="az">A – Z</SelectItem>
        </SelectContent>
      </Select>

      <Button onClick={onCreate} className="h-11 rounded-full hidden sm:inline-flex">
        <Plus className="mr-1.5 h-4 w-4" /> Create Club
      </Button>

      <p className="hidden text-xs text-muted-foreground md:block">
        {total} club{total === 1 ? "" : "s"}
      </p>
    </div>
  </div>
);
