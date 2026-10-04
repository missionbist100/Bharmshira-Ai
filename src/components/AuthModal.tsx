import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { X, Lock, Mail, Sparkles, Shield, AlertCircle } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="auth-modal-dialog"
        className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl p-6 relative text-gray-100"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-200 rounded-md hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">
              {isRegister ? "Create Bharmashira Account" : "Sign In to Bharmashira AI"}
            </h3>
            <p className="text-xs text-gray-400">100 daily queries & personalized chat history</p>
          </div>
        </div>

        {error && (
          <div className="my-3 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Fill Demo Credentials */}
        <div className="my-4 p-2.5 rounded-xl bg-gray-950/60 border border-gray-800 text-xs space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-3 h-3 text-blue-400" /> Quick Demo Credentials
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleQuickDemo("user@bharmashira.ai", "UserPass123!")}
              className="flex-1 py-1.5 px-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700/80 text-[11px] text-gray-300 transition-colors"
            >
              👤 Standard User
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo("admin@bharmashira.ai", "AdminPass123!")}
              className="flex-1 py-1.5 px-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-amber-700/60 text-[11px] text-amber-300 transition-colors"
            >
              🛡️ Admin User
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-all hover:shadow-blue-500/20 disabled:opacity-50 mt-2"
          >
            {loading ? "Processing..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-gray-800 text-center text-xs text-gray-400">
          {isRegister ? (
            <span>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setIsRegister(false)}
                className="text-blue-400 hover:underline font-medium"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Need an account?{" "}
              <button
                type="button"
                onClick={() => setIsRegister(true)}
                className="text-blue-400 hover:underline font-medium"
              >
                Register
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
