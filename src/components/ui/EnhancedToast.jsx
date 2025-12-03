import { toast as sonnerToast } from "sonner";
import { CheckCircle, XCircle, AlertCircle, Info, Loader2 } from "lucide-react";

export const toast = {
  success: (message, options = {}) => {
    sonnerToast.success(message, {
      icon: <CheckCircle className="w-5 h-5" />,
      duration: 3000,
      ...options,
      className: "bg-green-50 border-green-200 text-green-900",
    });
  },

  error: (message, options = {}) => {
    sonnerToast.error(message, {
      icon: <XCircle className="w-5 h-5" />,
      duration: 4000,
      ...options,
      className: "bg-red-50 border-red-200 text-red-900",
    });
  },

  warning: (message, options = {}) => {
    sonnerToast.warning(message, {
      icon: <AlertCircle className="w-5 h-5" />,
      duration: 3500,
      ...options,
      className: "bg-yellow-50 border-yellow-200 text-yellow-900",
    });
  },

  info: (message, options = {}) => {
    sonnerToast.info(message, {
      icon: <Info className="w-5 h-5" />,
      duration: 3000,
      ...options,
      className: "bg-blue-50 border-blue-200 text-blue-900",
    });
  },

  loading: (message, options = {}) => {
    return sonnerToast.loading(message, {
      icon: <Loader2 className="w-5 h-5 animate-spin" />,
      duration: Infinity,
      ...options,
      className: "bg-slate-50 border-slate-200 text-slate-900",
    });
  },

  promise: (promise, { loading, success, error }) => {
    return sonnerToast.promise(promise, {
      loading: {
        title: loading,
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
      },
      success: {
        title: success,
        icon: <CheckCircle className="w-5 h-5" />,
      },
      error: {
        title: error,
        icon: <XCircle className="w-5 h-5" />,
      },
    });
  },
};