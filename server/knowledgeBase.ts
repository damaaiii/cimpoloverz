/**
 * Knowledge Base Resmi SIMFONI FM untuk AI Studio (Server-Side)
 * Sumber utama:
 * - panduan_program__highlight__dan_script_siaran_simfoni_fm_ba3e6621.pdf
 *
 * ATURAN KETAT:
 * 1. Pedoman AI Highlight (Bagian B dokumen) dan Pedoman AI Script (Bagian C dokumen)
 *    dipisahkan secara tegas dan TIDAK BOLEH dicampur.
 * 2. Sapaan pendengar pada AI Highlight & AI Script menggunakan "Sobat Muda".
 */

export const KNOWLEDGE_BASE_REFS = {
  HIGHLIGHT_RULES_AND_EXAMPLE:
    'panduan_program__highlight__dan_script_siaran_simfoni_fm_ba3e6621.pdf (Bagian B: Aturan, Format Paten & Contoh Highlight)',
  SCRIPT_RULES:
    'panduan_program__highlight__dan_script_siaran_simfoni_fm_ba3e6621.pdf (Bagian C: Aturan Script Siaran)',
  PROGRAMS_GUIDE:
    'panduan_program__highlight__dan_script_siaran_simfoni_fm_ba3e6621.pdf (Bagian A) + FLOWCHART_2026 (Daily, Weekend, MarhabanYaRamadhan)',
};

export const HIGHLIGHT_KNOWLEDGE_CONTEXT = `
PEDOMAN RESMI SIMFONI HIGHLIGHT (Bagian B: Highlight — Ketat, Tidak Dicampur Script):

1. ATURAN PENYUSUNAN BERITA:
   - Berita WAJIB akurat dan mengandung unsur 5W+1H (What, Who, When, Where, Why, How) sesuai isi artikel sumber.
   - DILARANG KERAS mengarang fakta, angka, nama tokoh, jabatan, tanggal, kutipan, sumber berita, ataupun berita kedua jika hanya ada satu artikel sumber.
   - Gunakan bahasa Indonesia yang tidak baku, semiformal, luwes, komunikatif, dan enak didengar saat on-air (BUKAN copy-paste mentah artikel berita).
   - Gunakan sapaan pendengar "Sobat Muda" secara konsisten. JANGAN gunakan "Sobat Siar".
   - Panjang isi tiap berita WAJIB singkat dan padat: setara 4 sampai 8 baris di Microsoft Word ukuran font 12 (±55 sampai 115 kata per berita) dalam narasi siaran yang mengalir.

2. URUTAN & FORMAT PATEN SIMFONI HIGHLIGHT (WAJIB PERSIS TANPA TAMBAHAN APA PUN):
   Urutan jika ada 2 berita:
   [1] JUDUL BERITA 2 (diletakkan paling atas sebagai teaser berita kedua)
   [2] Kalimat pembuka paten: "Selengkapnya hanya di Simfoni Highlight barengan [nama penyiar]."
   [3] JUDUL BERITA 1
   [4] Isi berita pertama (4–8 baris, diawali natural menyapa "Sobat Muda", mencakup 5W+1H)
   [5] Pemisah jeda visual: "---"
   [6] Isi berita kedua (4–8 baris, mencakup 5W+1H dari sumber kedua)
   [7] Kalimat penutup paten: "Itu tadi Simfoni Highlight buat kamu, saatnya kita move ke lalu lalang."

   Urutan jika pengguna HANYA memberi 1 berita:
   - JANGAN mengarang berita kedua.
   - Tetap pakai kalimat pembuka paten "Selengkapnya hanya di Simfoni Highlight barengan [nama penyiar].", judul berita 1, isi berita pertama (4–8 baris, sapaan Sobat Muda, 5W+1H), dan kalimat penutup paten "Itu tadi Simfoni Highlight buat kamu, saatnya kita move ke lalu lalang.".

   LARANGAN FORMAT:
   - JANGAN menambahkan salam pembuka di luar format paten.
   - JANGAN menambahkan kalimat transisi, penutup, atau komentar tambahan di luar struktur di atas.

3. CONTOH ACUAN NADA & ALUR (JANGAN SALIN MENTAH):
   JUDUL BERITA 2: Prabowo Ingin Percepat Pemilihan Wapres Pengganti Gibran
   Selengkapnya hanya di Simfoni Highlight barengan Railey.
   JUDUL BERITA 1: Airlangga Respons Kekhawatiran Investor soal Mundurnya Gibran
   Isi Berita 1: Sobat Muda, kabar mundurnya Gibran Rakabuming Raka dari jabatan Wakil Presiden ternyata ikut jadi perhatian para investor. Menanggapi hal ini, Menteri Koordinator Bidang Perekonomian Airlangga Hartarto bilang kalau investor nggak perlu terlalu khawatir dengan kondisi politik Indonesia. Menurutnya, para investor lebih melihat gimana kondisi dan peluang ekonomi Indonesia ke depannya. Airlangga juga memastikan pemerintah tetap fokus menjaga stabilitas ekonomi dan menarik investasi. Jadi, pemerintah berharap situasi politik ini nggak sampai mengganggu kepercayaan investor.
   ---
   Isi Berita 2: Masih berkaitan dengan isu ekonomi dan pemerintahan, ...
   Itu tadi Simfoni Highlight buat kamu, saatnya kita move ke lalu lalang.
`.trim();

export const SCRIPT_KNOWLEDGE_CONTEXT = `
PEDOMAN RESMI SCRIPT SIARAN SIMFONI FM (Bagian C: Script Siaran — Ketat, Tidak Dicampur Highlight):

1. KETENTUAN PENYIAR:
   - Umumnya menggunakan 2 penyiar (Tandem), KECUALI Program Freeline (1 penyiar). Ikuti jumlah penyiar yang diberikan pengguna.
   - Pembagian dialog antarpenyiar WAJIB rata dan seimbang. Kedua penyiar saling menyahut dan merespons ucapan rekannya seperti sahabat di studio, BUKAN bergantian membaca teks satu arah.
   - Setiap giliran bicara singkat dan natural (1 - 3 kalimat per giliran), dengan total giliran cukup untuk memenuhi target durasi.
   - Interaksi bersifat 3 ARAH: penyiar 1, penyiar 2 (jika tandem), dan pendengar "Sobat Muda" saling terhubung.

2. STRUKTUR WAJIB 5 TALK PER SEGMEN & ATURAN TIAP BAGIAN:
   - TOH (Opening):
     * WAJIB diawali salam pembuka, misalnya "Assalamualaikum warahmatullahi wabarakatuh".
     * Langsung sapa pendengar dengan panggilan "Sobat Muda".
     * Perkenalkan nama penyiar, nama program, tema siaran, dan informasi durasi program jika tersedia.
     * Sertakan tagline resmi: "107,7 SIMFONI FM The Power Hits Station, dengerin lagu enak pilihanmu."
     * Gunakan bahasa siaran yang natural dan mengalir.
   - Talk 1 — Bridging ke Tema, Talk 2 — Tema, Talk 3 — Tema dan Interaksi (Segmen Isi):
     * Pembahasan tema berkembang secara mendalam — bukan pengantar pendek lalu pindah topik.
     * Kembangkan percakapan alami lewat: sudut pandang penyiar, tanggapan langsung ke rekan, pertanyaan ringan, contoh keseharian anak muda, informasi relevan, interaksi mengajak Sobat Muda relate/sharing, dan transisi natural antarbahasan.
     * Jangan mengulang gagasan yang sama atau basa-basi kosong demi mengejar jumlah kata.
   - Closing:
     * Berisi rangkuman singkat pembahasan, pesan penutup hangat untuk Sobat Muda, dan ucapan terima kasih.
     * Jika Closing Segmen 1 (masih lanjut ke segmen berikutnya): TIDAK perlu salam penutup akhir; tutup dengan jembatan menuju lagu/segmen 2.
     * Jika Closing Segmen 2 / Segmen Akhir (program selesai): WAJIB berformat pamit penyiar lalu salam penutup resmi persis:
       [Penyiar 1]: [Ucapan pamit kepada Sobat Muda]
       [Penyiar 2]: [Ucapan pamit kepada Sobat Muda] (jika tandem)
       [Salah satu penyiar / bersama]: "Wassalamualaikum warahmatullahi wabarakatuh, salam peace dan kreasi."

3. TARGET DURASI PER TALK (110 - 130 KATA PER MENIT):
   - Kecepatan bicara siaran radio 110 - 130 kata per menit (total kata seluruh giliran bicara dalam talk tersebut):
     * 1 menit ≈ 110 - 130 kata
     * 2 menit ≈ 220 - 260 kata
     * 3 menit ≈ 330 - 390 kata
     * 4 menit ≈ 440 - 520 kata
   - Jangan membuat talk jauh lebih pendek dari target durasinya.

4. GAYA BAHASA & LARANGAN KETAT:
   - Panggilan pendengar di AI Script WAJIB "Sobat Muda". DILARANG memakai "Sobat Siar".
   - WAJIB memakai kata "kita" (JANGAN memakai "kami") ketika penyiar berbicara mewakili diri bersama rekan penyiar atau SIMFONI FM (kecuali kutipan pihak ketiga).
   - Gunakan bahasa nonformal radio anak muda yang santai, ramah, akrab, dan komunikatif.
   - Gunakan panggilan "aku" dan "kamu". DILARANG KERAS memakai "lo" / "gue", dan hindari "kalian".
   - DILARANG bahasa kasar.
   - Harus terasa seperti obrolan spontan dua sahabat di studio, BUKAN tulisan AI yang kaku ("Selain itu", "Lebih lanjut", "Menariknya", "Di sisi lain", "Tak dapat dipungkiri").
`.trim();
