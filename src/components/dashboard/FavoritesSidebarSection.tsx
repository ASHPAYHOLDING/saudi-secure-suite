import { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { Star, GripVertical, X, ChevronDown } from "lucide-react";
import { useFavorites, type Favorite } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, Reorder } from "framer-motion";

interface Props {
  collapsed: boolean;
  isRTL: boolean;
}

const FavoritesSidebarSection = ({ collapsed, isRTL }: Props) => {
  const { favorites, reorderFavorites, removeFavorite } = useFavorites();
  const location = useLocation();
  const [open, setOpen] = useState(true);

  const handleReorder = useCallback(
    (items: Favorite[]) => {
      reorderFavorites(items.map((i) => i.id));
    },
    [reorderFavorites]
  );

  if (favorites.length === 0) return null;

  if (collapsed) {
    return (
      <div className="space-y-0.5 mb-3">
        {favorites.map((fav) => {
          const isActive = location.pathname === fav.path;
          return (
            <Link
              key={fav.id}
              to={fav.path}
              className={cn(
                "flex items-center justify-center rounded-lg p-2.5 transition-colors min-h-[44px]",
                isActive
                  ? "bg-sidebar-accent text-warning"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-warning"
              )}
              title={fav.label}
            >
              <Star size={16} className={isActive ? "fill-warning" : ""} />
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-warning/80 hover:text-warning transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Star size={12} className="fill-warning/60" />
          المفضلة
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "transition-transform duration-200",
            open ? "rotate-0" : isRTL ? "rotate-90" : "-rotate-90"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <Reorder.Group
              axis="y"
              values={favorites}
              onReorder={handleReorder}
              className="space-y-0.5"
            >
              {favorites.map((fav) => (
                <FavoriteItem
                  key={fav.id}
                  fav={fav}
                  isActive={location.pathname === fav.path}
                  onRemove={() => removeFavorite(fav.path)}
                />
              ))}
            </Reorder.Group>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FavoriteItem = ({
  fav,
  isActive,
  onRemove,
}: {
  fav: Favorite;
  isActive: boolean;
  onRemove: () => void;
}) => {
  const [hovering, setHovering] = useState(false);

  return (
    <Reorder.Item
      value={fav}
      className={cn(
        "group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-grab active:cursor-grabbing min-h-[40px]",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary font-semibold"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <GripVertical
        size={14}
        className={cn(
          "shrink-0 transition-opacity text-muted-foreground",
          hovering ? "opacity-100" : "opacity-0"
        )}
      />
      <Star size={14} className="shrink-0 fill-warning text-warning" />
      <Link to={fav.path} className="flex-1 truncate">
        {fav.label}
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className={cn(
          "shrink-0 p-0.5 rounded text-muted-foreground hover:text-destructive transition-opacity",
          hovering ? "opacity-100" : "opacity-0"
        )}
      >
        <X size={12} />
      </button>
    </Reorder.Item>
  );
};

export default FavoritesSidebarSection;
