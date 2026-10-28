# Corpus Atlas — prosedürel 3B insan anatomisi

`index.html` tek başına çalışan bir three.js sayfasıdır. Hiçbir hazır 3B model dosyası kullanmaz: 462 anatomik yapının tamamı (~3,8 milyon üçgen) sayfa açılırken tarayıcıda, kodla sıfırdan üretilir.

## Açmak

- `index.html` dosyasını güncel bir tarayıcıda açın (three.js CDN'den yüklendiği için internet bağlantısı gerekir).
- Daha zayıf cihazlar için `index.html?kalite=dusuk` (veya `#dusuk`), güçlü ekran kartları için `?kalite=yuksek`.

## İçerik

| Sistem | Ne var |
| --- | --- |
| İskelet | Kafatası (kaldırılabilir tavan), alt çene, 32 diş, 24 omur + diskler, sağrı, kaburgalar ve kıkırdakları, göğüs kemiği, omuz ve leğen kemeri, kol/bacak kemikleri, el ve ayaktaki tüm kemikler (27 + 26) |
| Kaslar | ~50 kas çifti, lif dokusu ve kirişleriyle; kaburgalar arası kaslar, parmak kirişleri |
| Organlar | Kıvrımlı beyin, beyincik, beyin sapı, gözler, kalp (atan), akciğerler (soluyan) ve bronş ağacı, diyafram, sindirim kanalı, karaciğer, pankreas, dalak, böbrekler, idrar yolları, endokrin bezler |
| Dolaşım | Aort ve dalları, koroner damarlar, ana toplardamarlar, yüzeyel venler, kapı toplardamarı, akciğer damarları |
| Sinir | Omurilik ve at kuyruğu, omurilik sinir kökleri, kaburgalar arası sinirler, kol ve bacak sinirleri, vagus, frenik, sempatik zincir, kafa çiftleri |

Her yapı tıklanabilir; Türkçe adı, Latince adı ve YKS düzeyinde kısa bir açıklaması vardır.

## Araçlar

Hazır görünümler (Tümü, Kaslar, İskelet, Organlar, Dolaşım, Sinir, Röntgen, Deri), katman başına opaklık, arama, koronal/sagital/transvers kesit, yarı kesit (kaslar yalnızca bir yarıda), ayrıştırma, kalp atışı ve solunum animasyonu, kan akışı ve sinir iletimi parçacıkları, etiketler.

## Nasıl üretiliyor

- Kemikler ve organlar işaretli uzaklık alanları (SDF) ile modellenir ve "surface nets" algoritmasıyla üçgen ağına çevrilir; uyarlamalı örnekleme yalnızca yüzeye yakın hücreleri hesaplar.
- Damarlar, sinirler, kaburgalar ve bağırsaklar eğri boyunca süpürülmüş tüplerdir.
- Kaslar, deri zarfının altına "giydirilmiş" kalınlıklı lif tabakalarıdır.
- Üretim görevleri Web Worker'lara dağıtılır; parçalar hazır oldukça sahneye eklenir.

## Geliştirme

Kaynak kod `src/` altındadır. Değişiklikten sonra tek dosyalık sayfayı yeniden üretmek için:

```sh
node build.mjs
```
