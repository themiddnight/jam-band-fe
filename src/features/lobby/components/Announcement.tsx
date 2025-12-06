interface AnnouncementProps {
  emoji?: string;
  title: string;
  message: string;
  highlight?: string;
}

export function Announcement({
  emoji = "🎉",
  title,
  message,
  highlight,
}: AnnouncementProps) {
  return (
    <div className="card bg-linear-to-br from-secondary/20 to-primary/20 shadow-xl border border-primary/30">
      <div className="card-body p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">{emoji}</div>
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-1">{title}</h3>
            <p className="text-sm text-base-content/80">
              {highlight && (
                <span className="font-medium text-secondary">{highlight}</span>
              )}{" "}
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
