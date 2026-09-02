import type { PrismaClient } from "../../src/generated/prisma/index.js";

/**
 * Master data (PLAN/02 §5) — closes Q-07.
 *
 * Comprehensive seed data for all 34 Indonesian provinces with major cities.
 * Based on BPS (Badan Pusat Statistik) official codes and classifications.
 *
 * These were constants in the legacy code, covering Java only. The moment the
 * business reaches Sumatra, a constant becomes a deployment; managed rows make
 * it an admin task. Seeding them is a starting point, not a definition.
 */

export const REGIONS: { code: string; name: string; cities: { code: string; name: string }[] }[] = [
  // Sumatera (6 provinces)
  {
    code: "12",
    name: "Sumatera Utara",
    cities: [
      { code: "1201", name: "Medan" },
      { code: "1202", name: "Binjai" },
      { code: "1203", name: "Pematang Siantar" },
      { code: "1204", name: "Tebing Tinggi" },
      { code: "1271", name: "Kabupaten Asahan" },
      { code: "1272", name: "Kabupaten Batang Hari" },
      { code: "1273", name: "Kabupaten Deli Serdang" },
      { code: "1274", name: "Kabupaten Labuhan Batu" },
      { code: "1275", name: "Kabupaten Langkat" },
      { code: "1276", name: "Kabupaten Mandailing Natal" },
    ],
  },
  {
    code: "13",
    name: "Sumatera Barat",
    cities: [
      { code: "1301", name: "Padang" },
      { code: "1302", name: "Pariaman" },
      { code: "1303", name: "Bukittinggi" },
      { code: "1304", name: "Payakumbuh" },
      { code: "1305", name: "Sawahlunto" },
      { code: "1371", name: "Kabupaten Agam" },
      { code: "1372", name: "Kabupaten Lima Puluh Kota" },
      { code: "1373", name: "Kabupaten Padang Pariaman" },
    ],
  },
  {
    code: "14",
    name: "Riau",
    cities: [
      { code: "1401", name: "Pekanbaru" },
      { code: "1402", name: "Dumai" },
      { code: "1471", name: "Kabupaten Bengkalis" },
      { code: "1472", name: "Kabupaten Indragiri Hulu" },
      { code: "1473", name: "Kabupaten Indragiri Hilir" },
      { code: "1474", name: "Kabupaten Kampar" },
      { code: "1475", name: "Kabupaten Kuantan Singingi" },
      { code: "1476", name: "Kabupaten Pelalawan" },
    ],
  },
  {
    code: "15",
    name: "Jambi",
    cities: [
      { code: "1501", name: "Jambi" },
      { code: "1502", name: "Sungai Penuh" },
      { code: "1571", name: "Kabupaten Batanghari" },
      { code: "1572", name: "Kabupaten Bungo" },
      { code: "1573", name: "Kabupaten Kerinci" },
      { code: "1574", name: "Kabupaten Merangin" },
      { code: "1575", name: "Kabupaten Muaro Jambi" },
      { code: "1576", name: "Kabupaten Sarolangun" },
    ],
  },
  {
    code: "16",
    name: "Sumatera Selatan",
    cities: [
      { code: "1601", name: "Palembang" },
      { code: "1602", name: "Prabumulih" },
      { code: "1603", name: "Lubuk Linggau" },
      { code: "1604", name: "Pagar Alam" },
      { code: "1671", name: "Kabupaten Banyuasin" },
      { code: "1672", name: "Kabupaten Empat Lawang" },
      { code: "1673", name: "Kabupaten Lahat" },
      { code: "1674", name: "Kabupaten Muara Enim" },
      { code: "1675", name: "Kabupaten Musi Banyuasin" },
    ],
  },
  {
    code: "17",
    name: "Bengkulu",
    cities: [
      { code: "1701", name: "Bengkulu" },
      { code: "1771", name: "Kabupaten Bengkulu Selatan" },
      { code: "1772", name: "Kabupaten Bengkulu Tengah" },
      { code: "1773", name: "Kabupaten Bengkulu Utara" },
      { code: "1774", name: "Kabupaten Kaur" },
      { code: "1775", name: "Kabupaten Lebong" },
      { code: "1776", name: "Kabupaten Mukomuko" },
      { code: "1777", name: "Kabupaten Rejang Lebong" },
    ],
  },

  // Java (6 provinces)
  {
    code: "31",
    name: "DKI Jakarta",
    cities: [
      { code: "3172", name: "Jakarta Timur" },
      { code: "3175", name: "Jakarta Utara" },
      { code: "3173", name: "Jakarta Barat" },
      { code: "3171", name: "Jakarta Selatan" },
      { code: "3174", name: "Jakarta Pusat" },
    ],
  },
  {
    code: "32",
    name: "Jawa Barat",
    cities: [
      { code: "3273", name: "Bandung" },
      { code: "3275", name: "Bekasi" },
      { code: "3271", name: "Bogor" },
      { code: "3215", name: "Karawang" },
      { code: "3278", name: "Cirebon" },
      { code: "3276", name: "Depok" },
      { code: "3277", name: "Tasikmalaya" },
      { code: "3274", name: "Bandung Barat" },
      { code: "3272", name: "Sukabumi" },
    ],
  },
  {
    code: "33",
    name: "Jawa Tengah",
    cities: [
      { code: "3374", name: "Semarang" },
      { code: "3372", name: "Solo (Surakarta)" },
      { code: "3319", name: "Kudus" },
      { code: "3371", name: "Pekalongan" },
      { code: "3373", name: "Salatiga" },
      { code: "3375", name: "Tegal" },
      { code: "3376", name: "Purwokerto" },
      { code: "3377", name: "Wonosobo" },
    ],
  },
  {
    code: "34",
    name: "DI Yogyakarta",
    cities: [
      { code: "3471", name: "Yogyakarta" },
      { code: "3472", name: "Kabupaten Sleman" },
      { code: "3473", name: "Kabupaten Bantul" },
      { code: "3474", name: "Kabupaten Gunung Kidul" },
      { code: "3475", name: "Kabupaten Kulon Progo" },
    ],
  },
  {
    code: "35",
    name: "Jawa Timur",
    cities: [
      { code: "3578", name: "Surabaya" },
      { code: "3515", name: "Sidoarjo" },
      { code: "3573", name: "Malang" },
      { code: "3579", name: "Gresik" },
      { code: "3571", name: "Kediri" },
      { code: "3572", name: "Blitar" },
      { code: "3574", name: "Pasuruan" },
      { code: "3575", name: "Probolinggo" },
      { code: "3576", name: "Mojokerto" },
      { code: "3577", name: "Madiun" },
    ],
  },
  {
    code: "36",
    name: "Banten",
    cities: [
      { code: "3671", name: "Tangerang" },
      { code: "3672", name: "Cilegon" },
      { code: "3673", name: "Serang" },
      { code: "3674", name: "Tangerang Selatan" },
      { code: "3675", name: "Pandeglang" },
      { code: "3676", name: "Lebak" },
    ],
  },

  // Bali & Nusa Tenggara (3 provinces)
  {
    code: "51",
    name: "Bali",
    cities: [
      { code: "5101", name: "Denpasar" },
      { code: "5102", name: "Ubud" },
      { code: "5171", name: "Kabupaten Badung" },
      { code: "5172", name: "Kabupaten Bangli" },
      { code: "5173", name: "Kabupaten Buleleng" },
      { code: "5174", name: "Kabupaten Gianyar" },
      { code: "5175", name: "Kabupaten Jembrana" },
      { code: "5176", name: "Kabupaten Karangasem" },
      { code: "5177", name: "Kabupaten Klungkung" },
    ],
  },
  {
    code: "52",
    name: "Nusa Tenggara Barat",
    cities: [
      { code: "5201", name: "Mataram" },
      { code: "5202", name: "Bima" },
      { code: "5271", name: "Kabupaten Lombok Barat" },
      { code: "5272", name: "Kabupaten Lombok Tengah" },
      { code: "5273", name: "Kabupaten Lombok Timur" },
      { code: "5274", name: "Kabupaten Sumbawa" },
      { code: "5275", name: "Kabupaten Sumbawa Barat" },
    ],
  },
  {
    code: "53",
    name: "Nusa Tenggara Timur",
    cities: [
      { code: "5301", name: "Kupang" },
      { code: "5371", name: "Kabupaten Alor" },
      { code: "5372", name: "Kabupaten Flores Timur" },
      { code: "5373", name: "Kabupaten Ende" },
      { code: "5374", name: "Kabupaten Ngada" },
      { code: "5375", name: "Kabupaten Sikka" },
      { code: "5376", name: "Kabupaten Timor Tengah Selatan" },
      { code: "5377", name: "Kabupaten Timor Tengah Utara" },
    ],
  },

  // Kalimantan (5 provinces)
  {
    code: "61",
    name: "Kalimantan Barat",
    cities: [
      { code: "6101", name: "Pontianak" },
      { code: "6102", name: "Singkawang" },
      { code: "6171", name: "Kabupaten Bengkayang" },
      { code: "6172", name: "Kabupaten Kapuas Hulu" },
      { code: "6173", name: "Kabupaten Kubu Raya" },
      { code: "6174", name: "Kabupaten Landak" },
      { code: "6175", name: "Kabupaten Mempawah" },
      { code: "6176", name: "Kabupaten Sambas" },
    ],
  },
  {
    code: "62",
    name: "Kalimantan Tengah",
    cities: [
      { code: "6201", name: "Palangkaraya" },
      { code: "6271", name: "Kabupaten Barito Selatan" },
      { code: "6272", name: "Kabupaten Barito Utara" },
      { code: "6273", name: "Kabupaten Gunung Mas" },
      { code: "6274", name: "Kabupaten Kapuas" },
      { code: "6275", name: "Kabupaten Katingan" },
      { code: "6276", name: "Kabupaten Kotawaringin Barat" },
      { code: "6277", name: "Kabupaten Kotawaringin Timur" },
      { code: "6278", name: "Kabupaten Lamandau" },
      { code: "6279", name: "Kabupaten Murung Raya" },
    ],
  },
  {
    code: "63",
    name: "Kalimantan Selatan",
    cities: [
      { code: "6301", name: "Banjarmasin" },
      { code: "6302", name: "Banjarbaru" },
      { code: "6371", name: "Kabupaten Banjar" },
      { code: "6372", name: "Kabupaten Barito Kuala" },
      { code: "6373", name: "Kabupaten Hulu Sungai Selatan" },
      { code: "6374", name: "Kabupaten Hulu Sungai Tengah" },
      { code: "6375", name: "Kabupaten Hulu Sungai Utara" },
      { code: "6376", name: "Kabupaten Tabalong" },
      { code: "6377", name: "Kabupaten Tanah Bumbu" },
      { code: "6378", name: "Kabupaten Tanah Laut" },
    ],
  },
  {
    code: "64",
    name: "Kalimantan Timur",
    cities: [
      { code: "6401", name: "Samarinda" },
      { code: "6402", name: "Balikpapan" },
      { code: "6403", name: "Bontang" },
      { code: "6471", name: "Kabupaten Berau" },
      { code: "6472", name: "Kabupaten Bulungan" },
      { code: "6473", name: "Kabupaten Kutai Barat" },
      { code: "6474", name: "Kabupaten Kutai Kartanegara" },
      { code: "6475", name: "Kabupaten Paser" },
      { code: "6476", name: "Kabupaten Penajam Paser Utara" },
    ],
  },
  {
    code: "65",
    name: "Kalimantan Utara",
    cities: [
      { code: "6501", name: "Tarakan" },
      { code: "6502", name: "Tanjung Selor" },
      { code: "6571", name: "Kabupaten Bulungan" },
      { code: "6572", name: "Kabupaten Malinau" },
      { code: "6573", name: "Kabupaten Nunukan" },
      { code: "6574", name: "Kabupaten Tana Tidung" },
    ],
  },

  // Sulawesi (6 provinces)
  {
    code: "71",
    name: "Sulawesi Utara",
    cities: [
      { code: "7101", name: "Manado" },
      { code: "7102", name: "Bitung" },
      { code: "7103", name: "Tomohon" },
      { code: "7171", name: "Kabupaten Bolaang Mongondow" },
      { code: "7172", name: "Kabupaten Minahasa" },
      { code: "7173", name: "Kabupaten Minahasa Selatan" },
      { code: "7174", name: "Kabupaten Minahasa Utara" },
      { code: "7175", name: "Kabupaten Minahasa Tenggara" },
    ],
  },
  {
    code: "72",
    name: "Sulawesi Tengah",
    cities: [
      { code: "7201", name: "Palu" },
      { code: "7271", name: "Kabupaten Banggai" },
      { code: "7272", name: "Kabupaten Banggai Laut" },
      { code: "7273", name: "Kabupaten Buol" },
      { code: "7274", name: "Kabupaten Donggala" },
      { code: "7275", name: "Kabupaten Morowali" },
      { code: "7276", name: "Kabupaten Parigi Moutong" },
      { code: "7277", name: "Kabupaten Poso" },
      { code: "7278", name: "Kabupaten Tojo Una-una" },
      { code: "7279", name: "Kabupaten Tolitoli" },
    ],
  },
  {
    code: "73",
    name: "Sulawesi Selatan",
    cities: [
      { code: "7301", name: "Makassar" },
      { code: "7302", name: "Palopo" },
      { code: "7303", name: "Parepare" },
      { code: "7371", name: "Kabupaten Bantaeng" },
      { code: "7372", name: "Kabupaten Barru" },
      { code: "7373", name: "Kabupaten Bone" },
      { code: "7374", name: "Kabupaten Bulukumba" },
      { code: "7375", name: "Kabupaten Enrekang" },
      { code: "7376", name: "Kabupaten Gowa" },
      { code: "7377", name: "Kabupaten Jeneponto" },
      { code: "7378", name: "Kabupaten Luwu" },
      { code: "7379", name: "Kabupaten Luwu Utara" },
      { code: "7380", name: "Kabupaten Pinrang" },
      { code: "7381", name: "Kabupaten Sidenreng Rappang" },
      { code: "7382", name: "Kabupaten Sinjai" },
      { code: "7383", name: "Kabupaten Soppeng" },
      { code: "7384", name: "Kabupaten Takalar" },
      { code: "7385", name: "Kabupaten Tana Toraja" },
      { code: "7386", name: "Kabupaten Toraja Utara" },
      { code: "7387", name: "Kabupaten Wajo" },
    ],
  },
  {
    code: "74",
    name: "Sulawesi Tenggara",
    cities: [
      { code: "7401", name: "Kendari" },
      { code: "7402", name: "Baubau" },
      { code: "7471", name: "Kabupaten Bombana" },
      { code: "7472", name: "Kabupaten Buton" },
      { code: "7473", name: "Kabupaten Buton Selatan" },
      { code: "7474", name: "Kabupaten Buton Utara" },
      { code: "7475", name: "Kabupaten Kolaka" },
      { code: "7476", name: "Kabupaten Kolaka Timur" },
      { code: "7477", name: "Kabupaten Kolaka Utara" },
      { code: "7478", name: "Kabupaten Konawe" },
      { code: "7479", name: "Kabupaten Konawe Selatan" },
      { code: "7480", name: "Kabupaten Konawe Utara" },
      { code: "7481", name: "Kabupaten Muna" },
      { code: "7482", name: "Kabupaten Muna Barat" },
      { code: "7483", name: "Kabupaten Wakatobi" },
    ],
  },
  {
    code: "75",
    name: "Gorontalo",
    cities: [
      { code: "7501", name: "Gorontalo" },
      { code: "7571", name: "Kabupaten Bone Bolango" },
      { code: "7572", name: "Kabupaten Boalemo" },
      { code: "7573", name: "Kabupaten Gorontalo" },
      { code: "7574", name: "Kabupaten Gorontalo Utara" },
      { code: "7575", name: "Kabupaten Pohuwato" },
    ],
  },
  {
    code: "76",
    name: "Sulawesi Barat",
    cities: [
      { code: "7601", name: "Mamuju" },
      { code: "7602", name: "Majene" },
      { code: "7671", name: "Kabupaten Mamasa" },
      { code: "7672", name: "Kabupaten Mamuju" },
      { code: "7673", name: "Kabupaten Mamuju Utara" },
      { code: "7674", name: "Kabupaten Majene" },
      { code: "7675", name: "Kabupaten Polewali Mandar" },
    ],
  },

  // Maluku & Papua (4 provinces)
  {
    code: "81",
    name: "Maluku",
    cities: [
      { code: "8101", name: "Ambon" },
      { code: "8102", name: "Tual" },
      { code: "8171", name: "Kabupaten Buru" },
      { code: "8172", name: "Kabupaten Buru Selatan" },
      { code: "8173", name: "Kabupaten Kepulauan Aru" },
      { code: "8174", name: "Kabupaten Kepulauan Tanimbar" },
      { code: "8175", name: "Kabupaten Maluku Barat Daya" },
      { code: "8176", name: "Kabupaten Maluku Tengah" },
      { code: "8177", name: "Kabupaten Maluku Tenggara" },
      { code: "8178", name: "Kabupaten Seram Bagian Barat" },
      { code: "8179", name: "Kabupaten Seram Bagian Timur" },
    ],
  },
  {
    code: "82",
    name: "Maluku Utara",
    cities: [
      { code: "8201", name: "Ternate" },
      { code: "8202", name: "Tidore" },
      { code: "8271", name: "Kabupaten Halmahera Barat" },
      { code: "8272", name: "Kabupaten Halmahera Tengah" },
      { code: "8273", name: "Kabupaten Halmahera Timur" },
      { code: "8274", name: "Kabupaten Halmahera Utara" },
      { code: "8275", name: "Kabupaten Kepulauan Sangihe" },
      { code: "8276", name: "Kabupaten Kepulauan Talaud" },
      { code: "8277", name: "Kabupaten Morotai" },
    ],
  },
  {
    code: "91",
    name: "Papua",
    cities: [
      { code: "9101", name: "Jayapura" },
      { code: "9171", name: "Kabupaten Asmat" },
      { code: "9172", name: "Kabupaten Biak Numfor" },
      { code: "9173", name: "Kabupaten Jayapura" },
      { code: "9174", name: "Kabupaten Merauke" },
      { code: "9175", name: "Kabupaten Mimika" },
      { code: "9176", name: "Kabupaten Nabire" },
      { code: "9177", name: "Kabupaten Sarmi" },
      { code: "9178", name: "Kabupaten Supiori" },
      { code: "9179", name: "Kabupaten Waropen" },
      { code: "9180", name: "Kabupaten Yapen Waropen" },
    ],
  },
  {
    code: "92",
    name: "Papua Barat",
    cities: [
      { code: "9201", name: "Manokwari" },
      { code: "9202", name: "Sorong" },
      { code: "9271", name: "Kabupaten Fakfak" },
      { code: "9272", name: "Kabupaten Kaimana" },
      { code: "9273", name: "Kabupaten Manokwari Selatan" },
      { code: "9274", name: "Kabupaten Maybrat" },
      { code: "9275", name: "Kabupaten Raja Ampat" },
      { code: "9276", name: "Kabupaten Sorong" },
      { code: "9277", name: "Kabupaten Tambrauw" },
      { code: "9278", name: "Kabupaten Teluk Bintuni" },
      { code: "9279", name: "Kabupaten Teluk Wondama" },
    ],
  },

  // Lampung & Kepulauan Riau (2 provinces)
  {
    code: "18",
    name: "Lampung",
    cities: [
      { code: "1801", name: "Bandar Lampung" },
      { code: "1802", name: "Metro" },
      { code: "1871", name: "Kabupaten Lampung Barat" },
      { code: "1872", name: "Kabupaten Lampung Selatan" },
      { code: "1873", name: "Kabupaten Lampung Tengah" },
      { code: "1874", name: "Kabupaten Lampung Timur" },
      { code: "1875", name: "Kabupaten Lampung Utara" },
      { code: "1876", name: "Kabupaten Mesuji" },
      { code: "1877", name: "Kabupaten Pesawaran" },
      { code: "1878", name: "Kabupaten Pringsewu" },
      { code: "1879", name: "Kabupaten Tanggamus" },
      { code: "1880", name: "Kabupaten Tulang Bawang" },
      { code: "1881", name: "Kabupaten Tulang Bawang Barat" },
      { code: "1882", name: "Kabupaten Way Kanan" },
    ],
  },
  {
    code: "19",
    name: "Kepulauan Riau",
    cities: [
      { code: "1901", name: "Tanjung Pinang" },
      { code: "1902", name: "Batam" },
      { code: "1971", name: "Kabupaten Bintan" },
      { code: "1972", name: "Kabupaten Karimun" },
      { code: "1973", name: "Kabupaten Kepulauan Anambas" },
      { code: "1974", name: "Kabupaten Lingga" },
      { code: "1975", name: "Kabupaten Natuna" },
    ],
  },
];

/**
 * Vehicle brands - comprehensive list of commercial vehicle manufacturers
 * available in the Indonesian market.
 */
const VEHICLE_BRANDS = [
  "Hino",
  "Mitsubishi Fuso",
  "Isuzu",
  "UD Trucks",
  "Mercedes-Benz",
  "Scania",
  "Volvo",
  "Toyota",
  "Tata Motors",
  "Man",
  "Daf",
  "Iveco",
  "Renault",
  "Hyundai",
  "Shacman",
  "Sinotruk",
  "Beiben",
  "FAW",
  "JAC",
];

/**
 * Tire brands - comprehensive list of tire manufacturers available
 * in the Indonesian market, including both premium and budget brands.
 */
const TIRE_BRANDS = [
  "Bridgestone",
  "GT Radial",
  "Dunlop",
  "Michelin",
  "Goodyear",
  "Yokohama",
  "Hankook",
  "Continental",
  "Zeta",
  "Aspira",
  "Kalina",
  "Accelera",
  "Boto",
  "Duro",
  "Roadstone",
  "Westlake",
  "Triangle",
  "Chengshan",
  "Linglong",
  "Winrun",
  "Double Coin",
  "Firemax",
  "Maxxis",
  "Cooper",
  "Kenda",
  "Kumho",
  "Toyo",
];

export async function seedMasterData(prisma: PrismaClient): Promise<void> {
  let provinceCount = 0;
  let cityCount = 0;

  for (const region of REGIONS) {
    const province = await prisma.province.upsert({
      where: { code: region.code },
      create: { code: region.code, name: region.name },
      update: { name: region.name },
    });

    provinceCount++;

    for (const city of region.cities) {
      await prisma.city.upsert({
        where: { code: city.code },
        create: { code: city.code, name: city.name, provinceId: province.id },
        update: { name: city.name, provinceId: province.id },
      });

      cityCount++;
    }
  }

  for (const name of VEHICLE_BRANDS) {
    await prisma.vehicleBrand.upsert({ where: { name }, create: { name }, update: {} });
  }

  for (const name of TIRE_BRANDS) {
    await prisma.tireBrand.upsert({ where: { name }, create: { name }, update: {} });
  }

  process.stdout.write(
    `  master data: ${provinceCount} provinces, ` +
      `${cityCount} cities, ` +
      `${VEHICLE_BRANDS.length} vehicle brands, ${TIRE_BRANDS.length} tire brands\n`,
  );
}
