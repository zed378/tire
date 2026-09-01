import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ROLES_REQUIRING_MFA,
  USER_ROLE_LABELS,
  type MfaEnrollmentResult,
  type MfaEnrollmentStart,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { useSession } from "../../lib/session.tsx";
import { Banner, ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input } from "../../components/ui/primitives.tsx";

/**
 * TOTP enrolment (PLAN/13 §3).
 *
 * TOTP rather than SMS or WhatsApp, and the deciding reason is not cost: it
 * works with no signal at all. The core work of this system happens in garages
 * and vehicle pools, and a one-time code that needs a cell tower fails exactly
 * where the application is used.
 *
 * Mandatory for `admin` and `operator`, optional for everyone else. Making it
 * mandatory for all sounds safer and ends with field suppliers locked out
 * because they changed phones.
 */
export function MfaEnrollPage(): ReactNode {
  const { user, refresh } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const status = useQuery({
    queryKey: ["mfa-status"],
    queryFn: () =>
      api.get<{ enrolled: boolean; required: boolean; remainingRecoveryCodes: number }>(
        "/api/auth/mfa/status",
      ),
  });

  const enrollment = useMutation({
    mutationFn: () => api.post<MfaEnrollmentStart>("/api/auth/mfa/enroll"),
  });

  const confirmation = useMutation({
    mutationFn: (value: string) => api.post<MfaEnrollmentResult>("/api/auth/mfa/confirm", { code: value }),
    onSuccess: async (result) => {
      setRecoveryCodes(result.recoveryCodes);
      await refresh();
      toast.push({ tone: "success", message: "Autentikasi dua faktor aktif." });
    },
    onError: () => setCodeError("Kode tidak cocok. Periksa jam perangkat Anda lalu coba lagi."),
  });

  const required = user !== null && ROLES_REQUIRING_MFA.includes(user.role);

  // Shown exactly once, at enrolment (PLAN/13 §3.3). There is no way back to
  // this screen for these codes, and that is stated plainly rather than implied.
  if (recoveryCodes !== null) {
    return (
      <div className="mx-auto max-w-lg">
        <Card title="Simpan kode pemulihan Anda">
          <Banner tone="warning" title="Kode ini hanya ditampilkan sekali">
            Simpan di tempat yang aman dan tidak berada di ponsel yang sama. Setiap kode hanya dapat
            dipakai satu kali, untuk masuk ketika Anda kehilangan akses ke aplikasi authenticator.
          </Banner>

          <ul className="mt-4 grid grid-cols-2 gap-2">
            {recoveryCodes.map((recoveryCode) => (
              <li
                key={recoveryCode}
                className="select-all rounded border border-slate-200 bg-slate-50 px-3 py-2 text-center font-mono text-sm"
              >
                {recoveryCode}
              </li>
            ))}
          </ul>

          <Button
            className="mt-4 w-full"
            onClick={() => void navigate("/inspections", { replace: true })}
          >
            Saya sudah menyimpannya
          </Button>
        </Card>
      </div>
    );
  }

  if (status.data?.enrolled === true) {
    return (
      <div className="mx-auto max-w-lg">
        <Card title="Autentikasi Dua Faktor">
          <Banner tone="success">Autentikasi dua faktor sudah aktif untuk akun Anda.</Banner>
          <p className="mt-3 text-sm text-slate-600">
            Sisa kode pemulihan: {status.data.remainingRecoveryCodes}. Kalau Anda kehilangan akses ke
            aplikasi authenticator dan kehabisan kode pemulihan, admin lain harus mengatur ulang —
            proses itu tercatat di jejak audit dan mengakhiri seluruh sesi Anda.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {required ? (
        <Banner tone="warning" title="Wajib untuk peran Anda">
          Peran {user === null ? "" : USER_ROLE_LABELS[user.role]} mewajibkan autentikasi dua faktor.
          Anda perlu menyelesaikan pendaftaran ini sebelum dapat mengakses fitur lain.
        </Banner>
      ) : null}

      <Card
        title="Aktifkan Autentikasi Dua Faktor"
        description="Gunakan aplikasi authenticator seperti Google Authenticator atau Authy. Kode dari aplikasi tersebut bekerja tanpa sinyal."
      >
        {enrollment.error !== null ? <ErrorBanner error={enrollment.error} /> : null}

        {enrollment.data === undefined ? (
          <Button
            onClick={() => enrollment.mutate()}
            loading={enrollment.isPending}
            loadingText="Menyiapkan…"
          >
            Mulai Pendaftaran
          </Button>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-700">
                1. Buka aplikasi authenticator, pilih tambah akun, lalu pindai kode QR atau masukkan
                kunci berikut secara manual:
              </p>
              <p className="mt-2 select-all break-all rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm">
                {enrollment.data.secretForManualEntry}
              </p>
              <p className="mt-2 break-all text-xs text-slate-500">{enrollment.data.otpauthUri}</p>
            </div>

            <Field
              label="2. Masukkan kode 6 angka dari aplikasi"
              htmlFor="mfa-code"
              error={codeError}
              required
            >
              <Input
                id="mfa-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                invalid={codeError !== undefined}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, ""));
                  setCodeError(undefined);
                }}
              />
            </Field>

            <Button
              onClick={() => confirmation.mutate(code)}
              loading={confirmation.isPending}
              loadingText="Memverifikasi…"
              disabled={code.length !== 6}
              className="w-full"
            >
              Aktifkan
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
