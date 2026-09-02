import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@c26/contracts";
import { Button, Input, Spinner } from "../../components/ui/primitives.tsx";
import { ErrorBanner } from "../../components/ui/feedback.tsx";

export function RegisterPage(): ReactNode {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<"weak" | "fair" | "good" | "strong" | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch("password");

  // Calculate password strength
  const calculateStrength = (pwd: string) => {
    if (!pwd) return null;
    let strength = 0;
    if (pwd.length >= 10) strength++;
    if (pwd.length >= 15) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    if (strength <= 1) return "weak";
    if (strength <= 2) return "fair";
    if (strength <= 3) return "good";
    return "strong";
  };

  const onPasswordChange = (value: string) => {
    setPasswordStrength(calculateStrength(value));
  };

  const onSubmit = async (data: RegisterInput) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.fieldErrors) {
          const usernameError = errorData.fieldErrors.find((e: any) => e.field === "username");
          if (usernameError) {
            setError(usernameError.message);
          } else {
            setError(errorData.fieldErrors[0]?.message || "Pendaftaran gagal.");
          }
        } else {
          setError(errorData.message || "Pendaftaran gagal.");
        }
        return;
      }

      // Redirect to welcome dashboard
      navigate("/welcome", { replace: true });
    } catch (err) {
      setError("Terjadi kesalahan. Coba lagi nanti.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-block mb-4 h-12 w-12 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600" />
          <h1 className="text-2xl font-bold text-white">Daftar Akun</h1>
          <p className="mt-2 text-slate-400">Buat akun untuk memulai</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <ErrorBanner error={error} />}

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
              User ID
            </label>
            <Input
              id="username"
              type="text"
              placeholder="username"
              disabled={loading}
              {...register("username")}
              className={errors.username ? "border-red-500" : ""}
            />
            {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username.message}</p>}
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-300 mb-2">
              Nama Lengkap
            </label>
            <Input
              id="displayName"
              type="text"
              placeholder="Nama lengkap Anda"
              disabled={loading}
              {...register("displayName")}
              className={errors.displayName ? "border-red-500" : ""}
            />
            {errors.displayName && <p className="mt-1 text-sm text-red-500">{errors.displayName.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Minimal 10 karakter"
              disabled={loading}
              {...register("password", {
                onChange: (e) => onPasswordChange(e.target.value),
              })}
              className={errors.password ? "border-red-500" : ""}
            />
            {password && (
              <div className="mt-2 flex gap-1">
                {["weak", "fair", "good", "strong"].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded ${
                      passwordStrength &&
                      ["weak", "fair", "good", "strong"].indexOf(passwordStrength) >=
                        ["weak", "fair", "good", "strong"].indexOf(level as any)
                        ? level === "weak"
                          ? "bg-red-500"
                          : level === "fair"
                            ? "bg-yellow-500"
                            : level === "good"
                              ? "bg-blue-500"
                              : "bg-green-500"
                        : "bg-slate-700"
                    }`}
                  />
                ))}
              </div>
            )}
            {password && passwordStrength && (
              <p className="mt-1 text-xs text-slate-400">
                Kekuatan: <span className="font-medium">{passwordStrength}</span>
              </p>
            )}
            {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
              Konfirmasi Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Ulang password"
              disabled={loading}
              {...register("confirmPassword")}
              className={errors.confirmPassword ? "border-red-500" : ""}
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword.message}</p>}
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 mt-6" disabled={loading}>
            {loading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Mendaftar...
              </>
            ) : (
              "Daftar"
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-slate-400 text-sm">
          Sudah punya akun?{" "}
          <a href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Masuk di sini
          </a>
        </p>
      </div>
    </div>
  );
}
