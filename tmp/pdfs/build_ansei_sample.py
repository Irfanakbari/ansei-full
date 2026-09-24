from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf'; OUT.mkdir(parents=True,exist_ok=True)
PDF=OUT/'ANSEI-dalam-1-Bulan-Contoh-Agustus-2026.pdf'
for n,f in [('Body','calibri.ttf'),('Bold','calibrib.ttf'),('Light','calibril.ttf')]:
    pdfmetrics.registerFont(TTFont(n,'C:/Windows/Fonts/'+f))
W,H=595.28,841.89
NAVY='#112B42'; TEAL='#087F8C'; MINT='#DDF2ED'; GOLD='#D79432'; RED='#BC5352'; INK='#223B4F'; GRAY='#637786'; BG='#F3F6F8'; LINE='#DCE5EA'
c=canvas.Canvas(str(PDF),pagesize=(W,H)); c.setTitle('ANSEI dalam 1 Bulan | Agustus 2026 | Data Ilustrasi'); c.setAuthor('ANSEI - Konsep laporan manajemen')
def rect(x,y,w,h,col,r=0):
    c.setFillColor(HexColor(col)); c.setStrokeColor(HexColor(col))
    if r:c.roundRect(x,H-y-h,w,h,r,stroke=0,fill=1)
    else:c.rect(x,H-y-h,w,h,stroke=0,fill=1)
def text(x,y,s,size=11,col=INK,font='Body'):
    c.setFillColor(HexColor(col)); c.setFont(font,size); c.drawString(x,H-y-size,s)
def para(x,y,s,w=507,size=11,col=INK,font='Body'):
    p=Paragraph(s,ParagraphStyle('p',fontName=font,fontSize=size,leading=size*1.38,textColor=HexColor(col)))
    _,h=p.wrap(w,700); p.drawOn(c,x,H-y-h); return h
def line(x1,y1,x2,y2,col=LINE,width=1):
    c.setStrokeColor(HexColor(col));c.setLineWidth(width);c.line(x1,H-y1,x2,H-y2)
def header(n,kicker,title,sub):
    rect(0,0,W,H,'#FFFFFF'); rect(0,0,W,7,TEAL)
    text(44,26,'ANSEI  /  MANAGEMENT INSIGHT',10,TEAL,'Bold');text(383,26,'AGUSTUS 2026  |  DEMO',9,GRAY)
    text(44,66,kicker.upper(),10,TEAL,'Bold');text(44,88,title,28,NAVY,'Bold');para(44,129,sub,size=11,col=GRAY)
    line(44,786,551,786);text(44,800,'DATA ILUSTRASI  |  Bukan laporan operasional aktual',8,GRAY)
    text(484,800,f'ANSEI / {n:02}',8,GRAY)
    c.bookmarkPage(f'p{n}'); c.addOutlineEntry(title,f'p{n}',0)
def done():c.showPage()
def card(x,y,w,title,value,detail,color=TEAL):
    rect(x,y,w,108,BG,9);rect(x,y,4,108,color)
    text(x+15,y+12,title,10,GRAY,'Bold');text(x+15,y+33,value,27,NAVY,'Bold');para(x+15,y+75,detail,w-27,9,GRAY)
def note(y,title,body,color=TEAL):
    rect(44,y,507,88,MINT if color==TEAL else '#FBF0DE',8)
    text(60,y+12,title,12,color,'Bold');para(60,y+34,body,475,10)
def table(y,headers,rows,widths,rowh=38):
    x=44;rect(x,y,507,30,NAVY)
    for hd,w in zip(headers,widths):text(x+10,y+8,hd,9,'#FFFFFF','Bold');x+=w
    for i,row in enumerate(rows):
        yy=y+30+i*rowh;rect(44,yy,507,rowh,BG if i%2==0 else '#FFFFFF');x=44
        for value,w in zip(row,widths):para(x+10,yy+9,str(value),w-18,10);x+=w
        line(44,yy+rowh,551,yy+rowh)
def bars(y,labels,vals,maxv=None,suffix='',colors=None):
    maxv=maxv or max(vals)*1.15
    for i,(lab,v) in enumerate(zip(labels,vals)):
        yy=y+i*43;text(44,yy+6,lab,10);rect(162,yy,310,25,BG,3);rect(162,yy,310*v/maxv,25,(colors or [TEAL]*len(vals))[i],3)
        text(482,yy+5,f'{v:,}'.replace(',','.')+suffix,10,INK,'Bold')
def chart(y,series,labels,maxv,height=190):
    x=77;cw=447;top=y;bottom=y+height
    for j in range(5):
        val=maxv*j/4; yy=bottom-height*j/4;line(x,yy,x+cw,yy);text(44,yy-6,f'{val/1000:g}k',9,GRAY)
    for name,values,col in series:
        pts=[(x+i*cw/(len(values)-1),bottom-v/maxv*height) for i,v in enumerate(values)]
        for a,b in zip(pts,pts[1:]):line(*a,*b,col,2.5)
        for xx,yy in pts:c.setFillColor(HexColor(col));c.circle(xx,H-yy,3,stroke=0,fill=1)
    for i,lab in enumerate(labels):text(x+i*cw/(len(labels)-1)-11,bottom+9,lab,9,GRAY)
    for i,(name,_,col) in enumerate(series):rect(77+i*160,bottom+36,13,4,col);text(96+i*160,bottom+30,name,9,GRAY)

# 01 / cover
rect(0,0,W,H,NAVY);rect(390,0,205,H,'#173A52');rect(44,47,55,5,'#53C4B4')
text(44,72,'ANSEI  /  MONTHLY MANAGEMENT REVIEW',11,'#8FDAD0','Bold')
text(44,159,'ANSEI',66,'#FFFFFF','Bold');text(44,241,'dalam 1 bulan',43,'#FFFFFF','Light')
text(47,312,'AGUSTUS 2026',18,'#8FDAD0','Bold')
para(47,363,'Dari aktivitas operasional<br/>menjadi informasi untuk keputusan.',450,20,'#FFFFFF','Light')
line(47,465,545,465,'#3D6175')
for x,v,l in [(47,'48.600','pcs good terverifikasi'),(218,'96,0%','capaian release bulan ini'),(395,'46.800','pcs dikirim tercatat')]:
    text(x,491,v,28,'#FFFFFF','Bold');text(x,534,l,10,'#B9D0DC')
rect(47,614,500,99,'#21485D',9);text(64,629,'CONTOH DESAIN / DATA SIMULASI',11,'#8FDAD0','Bold')
para(64,655,'Seluruh angka, part, temuan, dan rekomendasi dalam ebook ini dibuat untuk menunjukkan bentuk laporan. Bukan hasil pengambilan data ANSEI.',461,11,'#FFFFFF')
text(47,767,'Edisi contoh 01  |  Cutoff ilustrasi: 31 Agustus 2026, 23.59 WIB',9,'#B9D0DC');done()

# 02
header(2,'01 / Executive brief','Bulan ini, dalam satu halaman','Contoh ringkasan manajemen: hasil, gap, dan prioritas tindakan.')
for args in [(44,181,162,'GOOD TERVERIFIKASI','48.600','+8,0% dari Juli'),(217,181,162,'CAPAIAN RELEASE','96,0%','48.000 / 50.000 pcs'),(390,181,161,'DIKIRIM TERCATAT','46.800','+6,4% dari Juli'),(44,301,162,'BACKLOG AKHIR','4.400','pcs belum terpenuhi',GOLD),(217,301,162,'MATERIAL < MIN','7 SKU','dari 120 material aktif',GOLD),(390,301,161,'CHECKSHEET VALID','96,0%','1.200 / 1.250 record')]:card(*args)
text(44,439,'Tiga hal yang perlu dibahas',17,NAVY,'Bold')
for yy,num,title,body in [(479,'01','Output naik; gap release masih 2.000 pcs.','Sebanyak 600 pcs terverifikasi berasal dari release bulan sebelumnya. Total bulanan tidak sama dengan capaian release Agustus.'),(562,'02','Backlog pengiriman bertambah 400 pcs.','Kebutuhan baru 47.200 pcs melebihi pengiriman 46.800 pcs. Dahulukan pesanan dengan tenggat terlama.'),(645,'03','Administrasi manpower mendekati penutupan.','Masih ada 50 checksheet belum divalidasi. Selesaikan pemeriksaan sebelum proses penggajian.')]:
    text(44,yy,num,21,TEAL,'Bold');text(85,yy,title,12,INK,'Bold');para(85,yy+23,body,458,10)
done()

# 03
header(3,'02 / Tren bisnis','Pertumbuhan yang perlu dijaga','Tren enam bulan membantu membedakan perubahan sesaat dan arah perkembangan.')
text(44,182,'Good terverifikasi dan pengiriman tercatat',15,NAVY,'Bold')
chart(229,[('Good terverifikasi',[38000,40500,42000,43200,45000,48600],TEAL),('Pengiriman',[37200,39000,41000,42000,44000,46800],GOLD)],['Mar','Apr','Mei','Jun','Jul','Agu'],60000)
table(511,['Indikator','Juli','Agustus','Perubahan'],[
    ['Good terverifikasi','45.000','48.600','+8,0%'],['Pengiriman tercatat','44.000','46.800','+6,4%'],['Backlog akhir bulan','4.000','4.400','+10,0%'],['Checksheet tervalidasi','94,0%','96,0%','+2,0 poin']], [224,89,96,98],32)
note(680,'Interpretasi contoh','Pengiriman meningkat, tetapi backlog juga naik. Evaluasi pemenuhan pesanan menurut tenggat, bukan hanya kenaikan volume.');done()

# 04
header(4,'03 / Output fisik','Barang selesai yang terverifikasi','Sumber konsep: label unik sukses Poka-Yoke, dengan kuantitas QtyThisBox.')
card(44,180,245,'GOOD TERVERIFIKASI','48.600 pcs','Dihitung sekali untuk setiap label unik.');card(306,180,245,'PERTUMBUHAN BULANAN','+8,0%','Dibandingkan 45.000 pcs pada Juli.')
text(44,320,'Kontribusi output per part',15,NAVY,'Bold');bars(361,['FG-A','FG-B','FG-C','FG-D'],[18000,13200,10800,6600],21000)
note(561,'Cara membaca angka','Ini adalah output yang terverifikasi pada Agustus. Barang yang selesai pada Juli tetapi baru lolos Poka-Yoke pada Agustus dihitung pada Agustus.')
text(44,679,'Batas interpretasi',13,NAVY,'Bold');para(44,703,'Checksheet manpower tidak menjadi sumber output fisik. Scan gagal tidak menambah output, dan bukan bukti jumlah barang cacat.',507,11);done()

# 05
header(5,'04 / Rencana dan penyelesaian','96% target release terverifikasi','Kelompok yang dibandingkan: release dengan rencana pada Agustus, sampai cutoff bulan.')
card(44,180,162,'TARGET RELEASE','50.000','pcs target Agustus');card(217,180,162,'TERVERIFIKASI','48.000','pcs dari release Agustus');card(390,180,161,'SISA TARGET','2.000','pcs belum terverifikasi',GOLD)
table(331,['Part','Target','Terverifikasi','Gap'],[['FG-A','18.000','18.000','0'],['FG-B','14.000','13.200','800'],['FG-C','11.000','10.800','200'],['FG-D','7.000','6.000','1.000'],['TOTAL','50.000','48.000','2.000']],[183,108,116,100],37)
note(584,'Prioritas: FG-D dan FG-B','Kedua part menyumbang 1.800 pcs atau 90% sisa target. Periksa posisi barang dan status verifikasinya sebelum menyimpulkan adanya keterlambatan produksi.',GOLD)
para(44,700,'Rekonsiliasi output: 48.000 pcs dari release Agustus + 600 pcs FG-D dari release sebelumnya = 48.600 pcs terverifikasi bulan ini.',507,11);done()

# 06
header(6,'05 / Pengiriman','Volume naik, backlog belum turun','Pengiriman tercatat adalah kejadian di sistem; bukan bukti waktu penerimaan pelanggan.')
table(184,['Pergerakan backlog','Kuantitas'],[['Backlog awal Agustus','4.000 pcs'],['Kebutuhan baru jatuh tempo Agustus','47.200 pcs'],['Pemenuhan terhadap kebutuhan tersebut','(46.800) pcs'],['Backlog akhir Agustus','4.400 pcs']],[370,137],36)
text(44,395,'Umur keterlambatan pada akhir bulan',15,NAVY,'Bold');bars(435,['1-3 hari','4-7 hari','> 7 hari'],[1800,1600,1000],2100,colors=[TEAL,GOLD,RED])
note(605,'Tindakan yang disarankan','Prioritaskan 1.000 pcs dengan keterlambatan lebih dari tujuh hari. Konfirmasi kesiapan barang dan jadwal pengiriman dengan bagian terkait.',GOLD)
para(44,718,'Asumsi simulasi: seluruh pengiriman 46.800 pcs dialokasikan pada backlog awal dan kebutuhan jatuh tempo Agustus; tidak ada pengiriman lebih awal untuk September.',507,10,GRAY);done()

# 07
header(7,'06 / Persediaan','Pisahkan saldo dan kesiapan barang','Stok administrasi dan barang terverifikasi menjawab pertanyaan operasional yang berbeda.')
card(44,180,245,'SALDO FG TERCATAT','8.400 pcs','Posisi akhir berdasarkan ledger.');card(306,180,245,'TERVERIFIKASI BELUM KIRIM','6.800 pcs','Label lolos, belum ada pengiriman.')
note(312,'Selisih 1.600 pcs perlu ditelusuri','Dalam contoh ini, saldo administrasi lebih tinggi daripada qty terverifikasi belum kirim. Selisih ini tidak otomatis berarti WIP, kehilangan, atau kesalahan stok.',GOLD)
text(44,433,'Material prioritas untuk ditinjau',15,NAVY,'Bold')
table(470,['Material / unit','Saldo','Minimum','Status'],[['MAT-01 / pcs','300','500','Di bawah min'],['MAT-02 / pcs','450','600','Di bawah min'],['MAT-03 / meter','80','120','Di bawah min']],[197,83,100,127],40)
para(44,661,'7 dari 120 SKU aktif berada di bawah minimum; tabel menampilkan tiga contoh. Kuantitas dengan satuan berbeda tidak dijumlahkan. Minimum yang belum diisi tidak dinilai sebagai kondisi aman.',507,11);done()

# 08
header(8,'07 / Material dan incoming','Kesiapan dimulai dari kelengkapan','Kelebihan satu material tidak dapat menutup kekurangan material lain dalam BOM.')
card(44,181,162,'RELEASE DITINJAU','25','release aktif dalam contoh');card(217,181,162,'MATERIAL LENGKAP','22','release: seluruh kebutuhan cukup');card(390,181,161,'BELUM LENGKAP','3','release perlu tindak lanjut',GOLD)
table(331,['Release','Kelengkapan BOM','Kekurangan utama'],[['REL-081','8 / 8 material','Tidak ada'],['REL-082','7 / 8 material','MAT-01: 200 pcs'],['REL-083','5 / 6 material','MAT-03: 40 meter'],['REL-084','6 / 7 material','MAT-02: 150 pcs']],[112,185,210],43)
note(577,'Arah analisis','Periksa kebutuhan yang belum terpenuhi per material. Additional shopping menjadi sinyal untuk diperiksa, bukan otomatis pemborosan atau material NG.')
para(44,704,'Incoming dapat ditampilkan per material dan satuan berdasarkan penerimaan yang sah. Kinerja ketepatan supplier membutuhkan tanggal janji yang belum menjadi dasar contoh ini.',507,11);done()

# 09
header(9,'08 / Poka-Yoke','Baca kegagalan sebagai kejadian scan','Contoh operasional: satu label dapat gagal beberapa kali sebelum akhirnya sukses.')
card(44,180,162,'SCAN TERCATAT','2.520','seluruh percobaan tersimpan');card(217,180,162,'LABEL SUKSES','2.430','label unik; 48.600 pcs');card(390,180,161,'PERCOBAAN GAGAL','90','3,6% dari seluruh scan',GOLD)
table(331,['Rincian label yang mengalami kegagalan','Jumlah'],[['Label unik pernah gagal dalam bulan','60 label'],['Dari 60 label: kemudian sukses sampai cutoff','50 label'],['Dari 60 label: belum sukses sampai cutoff','10 label']],[399,108],46)
note(542,'90 kegagalan scan bukan 90 barang NG','Satu label bisa menghasilkan lebih dari satu percobaan gagal. Sepuluh label belum sukses perlu ditelusuri; belum dapat dianggap sepuluh box cacat.',GOLD)
text(44,666,'Rekomendasi contoh',13,NAVY,'Bold');para(44,692,'Tinjau 10 label yang belum sukses dan catat alasan kegagalannya. Pisahkan masalah label, ketidaksesuaian part, dan cacat produk setelah investigasi.',507,11);done()

# 10
header(10,'09 / Manpower dan checksheet','Kesiapan administrasi penggajian','Pcs pekerjaan adalah kredit pekerjaan manpower; bukan jumlah barang fisik.')
card(44,180,162,'CHECKSHEET VALID','1.200','dari 1.250 record (96,0%)');card(217,180,162,'MENUNGGU VALIDASI','50','record pada cutoff',GOLD);card(390,180,161,'PCS PEKERJAAN VALID','91.200','bukan output good fisik')
rect(44,324,507,157,NAVY,9);text(62,341,'CONTOH YANG MEMBEDAKAN DUA ANGKA',11,'#8FDAD0','Bold')
text(62,373,'10 barang  /  2 manpower',23,'#FFFFFF','Bold');para(62,412,'Masing-masing mencatat 10 pcs pekerjaan.<br/>Hasilnya: <b>20 pcs pekerjaan</b>, tetapi tetap <b>10 barang fisik</b>.',466,13,'#FFFFFF')
table(518,['Umur checksheet belum divalidasi','Record'],[['0-2 hari','30'],['3-7 hari','15'],['> 7 hari','5']],[399,108],32)
para(44,680,'Prioritas: selesaikan lima record berumur lebih dari tujuh hari. Nilai upah dan produktivitas individu tidak dihitung dalam contoh karena tarif serta standar pekerjaan belum ditetapkan.',507,11);done()

# 11
header(11,'10 / Keandalan informasi','Angka yang dapat dijelaskan','Contoh pemeriksaan kualitas data sebelum laporan diterbitkan otomatis.')
table(184,['Pemeriksaan','Hasil ilustrasi','Implikasi'],[['Label sukses memiliki waktu verifikasi','2.430 / 2.430','Layak untuk periode'],['Checksheet tervalidasi','1.200 / 1.250','50 record tertunda'],['Material dengan minimum terisi','110 / 120','10 SKU belum dinilai'],['Opname: baris dalam toleransi','95 / 100','5 baris ditelusuri']],[240,116,151],48)
text(44,448,'Kamus singkat untuk pembaca',16,NAVY,'Bold')
for yy,title,body in [(486,'Output terverifikasi','Qty label unik pada sukses Poka-Yoke pertama. Waktu scan menentukan bulan verifikasi.'),(558,'Pcs pekerjaan tervalidasi','Jumlah kredit pekerjaan pada checksheet sah. Tidak digunakan sebagai output fisik atau pembagi NG rate.'),(630,'Stok dan backlog','Stok mengikuti ledger. Backlog adalah kebutuhan jatuh tempo yang belum terpenuhi pada cutoff.')]:
    text(44,yy,title,12,TEAL,'Bold');para(44,yy+21,body,507,10)
para(44,724,'Semua pemeriksaan di halaman ini adalah simulasi desain, bukan hasil audit database. Opname 95% berlaku untuk baris yang dihitung, bukan seluruh persediaan.',507,9,GRAY);done()

# 12
header(12,'11 / Agenda bulan berikutnya','Tutup bulan dengan tindakan','Contoh rekomendasi untuk rapat manajemen; PIC dan tenggat di bawah bersifat usulan.')
table(183,['Prioritas / tindakan','PIC usulan','Tenggat'],[['01  Tinjau backlog > 7 hari (1.000 pcs)','Logistik','02 Sep'],['02  Telusuri gap FG-D dan FG-B (1.800 pcs)','Produksi','03 Sep'],['03  Validasi 50 checksheet tersisa','Admin produksi','03 Sep'],['04  Tinjau 7 material di bawah minimum','Warehouse','04 Sep'],['05  Investigasi 10 label belum sukses','Quality','04 Sep']],[316,119,72],48)
note(487,'Narasi penutup contoh','Output terverifikasi meningkat, sementara backlog masih bertambah. Fokus awal September adalah mempercepat pemenuhan pesanan tertua dan menyelesaikan administrasi manpower.')
text(44,609,'Bagaimana laporan ini nantinya terbit',15,NAVY,'Bold')
para(44,639,'ANSEI menghitung KPI dan menyimpan snapshot. GPT menyusun narasi dari agregat yang diizinkan; angka tetap berasal dari sistem. Jika narasi gagal divalidasi, gunakan template. Revisi data menghasilkan versi laporan baru.',507,11)
para(44,729,'Edisi ini hanya contoh bentuk PDF. Tidak ada pengiriman email, penjadwalan otomatis, perubahan aplikasi, atau pengambilan data operasional yang dilakukan.',507,9,GRAY);done()
c.save()
r=PdfReader(str(PDF));assert len(r.pages)==12
assert all(('ILUSTRASI' in p.extract_text() or 'DATA SIMULASI' in p.extract_text()) for p in r.pages)
print(str(PDF)); print('Verified: 12 pages; illustrative-data notice on all pages.')
