import { useState, type ReactNode } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton, StatTile, Textarea } from "../../components/ui/primitives.tsx";
import { Banner } from "../../components/ui/feedback.tsx";
import { Checkbox, Container, RadioGroup } from "../../components/ui/form-controls.tsx";

/**
 * Every token and primitive on one page, for review.
 *
 * TEMPORARY. PROMPT 5 removes this route and this file. It is not linked from
 * anywhere and carries no data, but it is reachable by anyone who knows the
 * path — so it must not outlive the redesign.
 */
export function StyleguidePage(): ReactNode {
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState<"pass" | "revisi" | "drop">("pass");
  const [note, setNote] = useState("");

  return (
    <div className="min-h-dvh bg-concrete py-10">
      <Container className="space-y-10">
        <header>
          <p className="font-data text-xs uppercase tracking-wider text-steel-ink">
            /__styleguide — sementara
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-graphite">Workshop Precision</h1>
          <p className="mt-2 max-w-prose text-base text-steel-ink">
            Token dan primitive untuk landing, login, dan register. Halaman ini dihapus di fase
            terakhir.
          </p>
        </header>

        <Section title="Warna">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <Swatch name="ink" hex="#16181C" className="bg-graphite" onDark />
            <Swatch name="concrete" hex="#E7E7E3" className="bg-concrete" />
            <Swatch name="paper" hex="#FFFFFF" className="bg-paper" />
            <Swatch name="steel" hex="#6E7580" className="bg-steel" onDark />
            <Swatch name="blue" hex="#1D4ED8" className="bg-blue" onDark />
            <Swatch name="amber" hex="#F0B429" className="bg-amber" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Swatch name="blue-deep" hex="#16307E" className="bg-blue-deep" onDark />
            <Swatch name="danger" hex="#C0392B" className="bg-signal-danger" onDark />
            <Swatch name="ok" hex="#1E8E5A" className="bg-signal-ok" onDark />
            <Swatch name="steel-ink" hex="#545A64" className="bg-steel-ink" onDark />
          </div>
          <p className="mt-3 max-w-prose text-sm text-steel-ink">
            <span className="font-medium text-graphite">steel</span> hanya 4,0:1 di atas concrete —
            gagal AA untuk teks normal. Teks sekunder di latar beton memakai{" "}
            <span className="font-medium text-graphite">steel-ink</span> (6,1:1).
          </p>
        </Section>

        <Section title="Tipografi">
          <div className="space-y-4 rounded-panel bg-paper p-6">
            <p className="font-display text-3xl font-bold text-graphite">
              Archivo — Ban habis lebih cepat
            </p>
            <p className="font-display text-xl font-semibold text-graphite">Archivo 600 — heading</p>
            <p className="max-w-prose text-base text-graphite">
              Plus Jakarta Sans — sistem pendataan ban bus dan truk. Satu nomor seri per pemeriksaan,
              foto per posisi ban, dan riwayat keputusan yang tidak bisa dihapus.
            </p>
            <p className="max-w-prose text-sm text-steel-ink">Plus Jakarta Sans 14px — teks bantuan.</p>
            <p className="font-data text-base text-graphite">
              IBM Plex Mono — 295/80 R22.5 · SN2026-00001 · B 1234 ABC
            </p>
            <p className="font-data text-sm text-steel-ink">
              tabular-nums: 1111111111 / 0000000000
            </p>
          </div>
        </Section>

        <Section title="Radius berjenjang">
          <div className="flex flex-wrap items-end gap-4">
            {[
              ["sharp", "rounded-sharp"],
              ["tight", "rounded-tight"],
              ["base", "rounded-base"],
              ["panel", "rounded-panel"],
            ].map(([name, cls]) => (
              <div key={name} className="text-center">
                <div className={`h-16 w-24 border border-steel/30 bg-paper ${cls ?? ""}`} />
                <p className="mt-1.5 font-data text-xs text-steel-ink">{name}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Elevasi">
          <div className="flex flex-wrap gap-4">
            <div className="rounded-panel border border-steel/20 bg-paper p-5 text-sm text-graphite">
              flat — garis, tanpa bayangan
            </div>
            <div className="rounded-panel bg-paper p-5 text-sm text-graphite shadow-raised">
              raised
            </div>
            <div className="rounded-panel bg-paper p-5 text-sm text-graphite shadow-overlay">
              overlay
            </div>
          </div>
        </Section>

        <Section title="Tombol">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading loadingText="Memeriksa…">
              Loading
            </Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
          </div>
          <p className="mt-3 text-sm text-steel-ink">
            Tekan untuk melihat turun 1px. Tab untuk melihat ring fokus{" "}
            <span className="font-medium text-graphite">amber</span>.
          </p>
        </Section>

        <Section title="Form">
          <div className="grid gap-6 rounded-panel bg-paper p-6 sm:grid-cols-2">
            <Field label="User ID" htmlFor="sg-user" hint="3–64 karakter" required>
              <Input id="sg-user" placeholder="joko_inspector" />
            </Field>

            <Field label="Ukuran ban" htmlFor="sg-size">
              <Input id="sg-size" className="font-data" placeholder="295/80 R22.5" />
            </Field>

            <Field label="Dengan slot" htmlFor="sg-slot" hint="Adornment kiri dan kanan">
              <Input
                id="sg-slot"
                leading={<span className="font-data text-xs">psi</span>}
                trailing={
                  <Button variant="ghost" size="sm" aria-label="Bersihkan">
                    ×
                  </Button>
                }
              />
            </Field>

            <Field label="Status" htmlFor="sg-status">
              <Select id="sg-status">
                <option>Pending QC</option>
                <option>Pass QC</option>
              </Select>
            </Field>

            <Field
              label="Catatan"
              htmlFor="sg-note"
              counter={{ value: note.length, max: 200 }}
              hint="Counter hanya dipakai bila batasnya nyata"
            >
              <Textarea
                id="sg-note"
                rows={3}
                maxLength={200}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
              />
            </Field>

            <Field label="Dengan error" htmlFor="sg-err" error="Plat nomor tidak dikenali.">
              <Input id="sg-err" defaultValue="B 1234 !!" invalid />
            </Field>

            <Checkbox
              label="Saya menyetujui syarat dan ketentuan"
              hint="Target sentuh 44px, lebih tinggi dari kotaknya"
              checked={checked}
              onChange={(event) => {
                setChecked(event.target.checked);
              }}
            />

            <RadioGroup
              legend="Keputusan QC"
              name="sg-qc"
              value={radio}
              onChange={setRadio}
              options={[
                { value: "pass", label: "Pass QC" },
                { value: "revisi", label: "Perlu Revisi", hint: "Wajib disertai alasan" },
                { value: "drop", label: "Drop QC" },
              ]}
            />
          </div>
        </Section>

        <Section title="Alert">
          <div className="space-y-3">
            <Banner tone="info">Foto terunggah saat aplikasi dibuka dan ada sinyal.</Banner>
            <Banner tone="success">Pengajuan dikirim ke antrean QC.</Banner>
            <Banner tone="warning" title="Perlu diperbaiki">
              Rincian poros berjumlah 3, sedangkan Jumlah Poros yang dipilih adalah 6.
            </Banner>
            <Banner tone="error" requestId="req_20260903_004512_a91f">
              Terjadi kesalahan pada sistem.
            </Banner>
          </div>
        </Section>

        <Section title="Lain-lain">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Pending QC" value={12} tone="warning" hint="Menunggu ditinjau" />
            <StatTile label="Bulan ini" value={148} />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>neutral</Badge>
            <Badge tone="accent">accent</Badge>
            <Badge tone="success">success</Badge>
            <Badge tone="warning">warning</Badge>
            <Badge tone="danger">danger</Badge>
            <Badge tone="info">info</Badge>
          </div>
          <Card className="mt-4">
            <EmptyState
              title="Belum ada pemeriksaan"
              description="Pemeriksaan yang Anda buat muncul di sini beserta statusnya."
              action={<Button>Pemeriksaan baru</Button>}
            />
          </Card>
        </Section>
      </Container>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-graphite">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Swatch({
  name,
  hex,
  className,
  onDark = false,
}: {
  name: string;
  hex: string;
  className: string;
  onDark?: boolean;
}): ReactNode {
  return (
    <div className={`rounded-panel border border-steel/20 p-4 ${className}`}>
      <p className={`text-sm font-semibold ${onDark ? "text-paper" : "text-graphite"}`}>{name}</p>
      <p className={`font-data text-xs ${onDark ? "text-paper/70" : "text-steel-ink"}`}>{hex}</p>
    </div>
  );
}
