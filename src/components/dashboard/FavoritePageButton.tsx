import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FavoritePageButtonProps {
  label: string;
  icon_name?: string;
}

const FavoritePageButton = ({ label, icon_name }: FavoritePageButtonProps) => {
  const { pathname } = useLocation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const starred = isFavorite(pathname);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() =>
            toggleFavorite({ label, path: pathname, icon_name })
          }
        >
          <Star
            size={16}
            className={cn(
              "transition-colors",
              starred
                ? "fill-warning text-warning"
                : "text-muted-foreground hover:text-warning"
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {starred ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      </TooltipContent>
    </Tooltip>
  );
};

export default FavoritePageButton;
