import { Button } from "@/components/ui/button";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-4">
        {Icon && <Icon className="w-8 h-8 text-slate-400" />}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 max-w-md mb-6">{description}</p>
      {action && actionLabel && (
        <Button onClick={action} className="bg-gradient-to-r from-indigo-600 to-purple-600">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}