import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

interface PageLoadingProps {
  message?: string;
}

export const PageLoading = ({ message }: PageLoadingProps) => {
  const { currentLang } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      <p className="text-sm text-muted-foreground">
        {message || (currentLang === "ar" ? "جاري التحميل..." : "Loading...")}
      </p>
    </div>
  );
};

interface PageErrorProps {
  message?: string;
  onRetry?: () => void;
}

export const PageError = ({ message, onRetry }: PageErrorProps) => {
  const { currentLang } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          {currentLang === "ar" ? "حدث خطأ" : "Something went wrong"}
        </p>
        <p className="text-xs text-muted-foreground max-w-sm">
          {message || (currentLang === "ar" ? "لم نتمكن من تحميل البيانات. حاول مرة أخرى." : "We couldn't load the data. Please try again.")}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {currentLang === "ar" ? "إعادة المحاولة" : "Retry"}
        </Button>
      )}
    </div>
  );
};

interface PageEmptyProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const PageEmpty = ({ icon: Icon = Inbox, title, description, actionLabel, onAction }: PageEmptyProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="gap-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
